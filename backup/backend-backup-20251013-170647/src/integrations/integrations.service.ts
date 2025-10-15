import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma.service';
import { sign, verify } from 'jsonwebtoken';
import { appendFileSync } from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import 'dotenv/config';
import fetch from 'node-fetch'; // Use node-fetch v2 for Apple CalDAV requests
// Use the global fetch API available in Node 18+ for Outlook and other APIs

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

const OUTLOOK_TENANT =
  process.env.OUTLOOK_OAUTH_TENANT ||
  'https://login.microsoftonline.com/common';
const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID;
const OUTLOOK_REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI;
const OUTLOOK_SCOPE =
  'User.Read Calendars.ReadWrite Calendars.ReadWrite.Shared ' +
  'MailboxSettings.Read OnlineMeetings.ReadWrite offline_access';

export function buildOutlookAuthUrl(state: string): string {
  return (
    OUTLOOK_TENANT + '/oauth2/v2.0/authorize' +
    '?client_id=' + encodeURIComponent(OUTLOOK_CLIENT_ID ?? '') +
    '&response_type=code' +
    '&redirect_uri=' + encodeURIComponent(OUTLOOK_REDIRECT_URI ?? '') +
    '&scope=' + encodeURIComponent(OUTLOOK_SCOPE) +
    '&response_mode=query' +
    '&prompt=consent' +
    '&state=' + state
  );
}

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  private zoomLog(...msgs: any[]) {
    const logPath = path.join(process.cwd(), 'zoom_debug.log');
    const line = `[${new Date().toISOString()}] ` + msgs.map(m =>
      typeof m === 'string' ? m : JSON.stringify(m)
    ).join(' ') + '\n';
    try {
      appendFileSync(logPath, line);
    } catch (err) {
      console.error('Failed to write zoom log', err);
    }
  }

  private outlookLog(...msgs: any[]) {
    const logPath = path.join(process.cwd(), 'outlook_debug.log');
    const line = `[${new Date().toISOString()}] ` + msgs.map(m =>
      typeof m === 'string' ? m : JSON.stringify(m)
    ).join(' ') + '\n';
    try {
      appendFileSync(logPath, line);
    } catch (err) {
      console.error('Failed to write outlook log', err);
    }
  }

  private env(name: string): string | undefined {
    const val = process.env[name];
    return val ? val.split('#')[0].trim() : undefined;
  }

  private oauthClient() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID',
      process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET',
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/integrations/google/callback',
    );
  }

  private createStatePayload(payload: any) {
    return sign(payload, process.env.JWT_SECRET || 'changeme', {
      expiresIn: '10m',
    });
  }

  private decodeStatePayload<T = any>(state: string): T {
    try {
      return verify(state, process.env.JWT_SECRET || 'changeme') as T;
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private computeCodeChallenge(verifier: string): string {
    const hash = crypto.createHash('sha256').update(verifier).digest('base64');
    return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private createState(userId: string) {
    return sign({ sub: userId }, process.env.JWT_SECRET || 'changeme', {
      expiresIn: '10m',
    });
  }

  private decodeState(state: string): string {
    try {
      const payload = verify(state, process.env.JWT_SECRET || 'changeme') as {
        sub: string;
      };
      return payload.sub;
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
  }

  generateGoogleAuthUrl(userId: string) {
    const client = this.oauthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: DEFAULT_SCOPES,
      state: this.createState(userId),
      prompt: 'consent',
    });
  }

  async handleGoogleCallback(code: string, state: string) {
    const userId = this.decodeState(state);
    const client = this.oauthClient();
    let tokens;
    try {
      const tokenResponse = await client.getToken(code);
      tokens = tokenResponse.tokens;
    } catch (err) {
      throw err;
    }
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    let data;
    try {
      const userInfo = await oauth2.userinfo.get();
      data = userInfo.data;
    } catch (err) {
      throw err;
    }
    const externalId = data.id ?? '';

    // DEBUG PRINT
    try {
      // Get user email from database
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.email) {
        console.log(`"${user.email}" Tried to connect "Google Calendar" and it was "Successful"`);
      }
    } catch (e) {
      // Ignore debug print errors
    }

    const existing = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'google' },
    });
    if (existing) {
      await this.prisma.externalCalendar.update({
        where: { id: existing.id },
        data: {
          external_id: externalId,
          access_token: tokens.access_token ?? null,
          refresh_token: tokens.refresh_token ?? existing.refresh_token,
        },
      });
    } else {
      await this.prisma.externalCalendar.create({
        data: {
          user_id: userId,
          provider: 'google',
          external_id: externalId,
          access_token: tokens.access_token ?? null,
          refresh_token: tokens.refresh_token ?? null,
        },
      });
    }
  }

  private async getGoogleCalendar(userId: string) {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'google' },
    });
    if (!record) return null;

    const client = this.oauthClient();
    client.setCredentials({
      access_token: record.access_token ?? undefined,
      refresh_token: record.refresh_token ?? undefined,
    });

    client.on('tokens', async (tokens) => {
      await this.prisma.externalCalendar.update({
        where: { id: record.id },
        data: {
          access_token: tokens.access_token ?? record.access_token,
          refresh_token: tokens.refresh_token ?? record.refresh_token,
        },
      });
    });

    return google.calendar({ version: 'v3', auth: client });
  }

  async listGoogleEvents(userId: string, timeMin?: string, timeMax?: string) {
    const calendar = await this.getGoogleCalendar(userId);
    if (!calendar) return [];
    const res = await calendar.events.list({
      calendarId: 'primary',
      singleEvents: true,
      timeMin,
      timeMax,
    });
    return res.data.items ?? [];
  }

  async disconnectGoogle(userId: string) {
    await this.prisma.externalCalendar.deleteMany({
      where: { user_id: userId, provider: 'google' },
    });
  }

  async isGoogleConnected(userId: string): Promise<boolean> {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'google' },
    });
    return !!(record && (record.access_token || record.refresh_token));
  }

  async refreshGoogleToken(userId: string): Promise<boolean> {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'google' },
    });
    
    if (!record || !record.refresh_token) {
      console.log('[GOOGLE DEBUG] refreshGoogleToken - no refresh token', { userId });
      return false;
    }

    try {
      const oauth2Client = this.oauthClient();
      oauth2Client.setCredentials({
        refresh_token: record.refresh_token,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log('[GOOGLE DEBUG] refreshGoogleToken - success', { userId, hasAccessToken: !!credentials.access_token });

      await this.prisma.externalCalendar.update({
        where: { id: record.id },
        data: {
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || record.refresh_token, // Keep old refresh token if new one not provided
        },
      });

      return true;
    } catch (error) {
      console.error('[GOOGLE DEBUG] refreshGoogleToken - error', { userId, error: error.message });
      return false;
    }
  }

  connectGoogleMeet(data: any) {
    return { message: 'google meet integration stub', data };
  }

  async handleZoomCallback(code: string, state: string) {
    console.log('[ZOOM DEBUG] handleZoomCallback called at:', new Date().toISOString());
    console.log('[ZOOM DEBUG] Code:', code);
    console.log('[ZOOM DEBUG] State:', state);
    this.zoomLog('handleZoomCallback start', { code, state });
    
    const decoded: any = this.decodeStatePayload(state);
    const userId = decoded?.sub as string;
    const codeVerifier = decoded?.zcv as string | undefined;
    console.log('[ZOOM DEBUG] Decoded userId:', userId);
    
    const clientId = this.env('ZOOM_CLIENT_ID');
    const clientSecret = this.env('ZOOM_CLIENT_SECRET');
    const redirectUri = this.env('ZOOM_REDIRECT_URI');
    console.log('[ZOOM DEBUG] OAuth config:', { clientId, redirectUri, hasSecret: !!clientSecret });
    if (!clientId || !clientSecret || !redirectUri) {
      this.zoomLog('missing env vars', { clientId, clientSecret, redirectUri });
      throw new Error('Missing Zoom OAuth environment variables');
    }
    // Exchange code for access token
    console.log('[ZOOM DEBUG] Exchanging code for token...');
    const tokenRes = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }),
    });
    console.log('[ZOOM DEBUG] Token exchange response status:', tokenRes.status);
    console.log('[ZOOM DEBUG] Token exchange response headers:', Object.fromEntries(tokenRes.headers.entries()));
    
    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('[ZOOM DEBUG] Token exchange failed:', errorText);
      this.zoomLog('token exchange failed', errorText);
      throw new Error('Failed to obtain Zoom tokens');
    }
    const tokens = await tokenRes.json();
    console.log('[ZOOM DEBUG] Token response received:', { access_token: tokens.access_token ? 'present' : 'missing', refresh_token: tokens.refresh_token ? 'present' : 'missing' });
    this.zoomLog('token response', tokens);
    // Get user info from Zoom
    console.log('[ZOOM DEBUG] Fetching user info from Zoom...');
    const userRes = await fetch('https://api.zoom.us/v2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });
    console.log('[ZOOM DEBUG] User info response status:', userRes.status);
    
    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error('[ZOOM DEBUG] User info fetch failed:', errorText);
      this.zoomLog('user fetch failed', errorText);
      throw new Error('Failed to fetch Zoom user info');
    }
    const userInfo = await userRes.json();
    console.log('[ZOOM DEBUG] User info received:', { id: userInfo.id, email: userInfo.email, first_name: userInfo.first_name, last_name: userInfo.last_name });
    this.zoomLog('userInfo', userInfo);
    const externalId = userInfo.id;
    // Store in DB
    console.log('[ZOOM DEBUG] Storing tokens in database...');
    const existing = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'zoom' },
    });
    if (existing) {
      console.log('[ZOOM DEBUG] Updating existing Zoom connection');
      await this.prisma.externalCalendar.update({
        where: { id: existing.id },
        data: {
          external_id: externalId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? existing.refresh_token,
        },
      });
    } else {
      console.log('[ZOOM DEBUG] Creating new Zoom connection');
      await this.prisma.externalCalendar.create({
        data: {
          user_id: userId,
          provider: 'zoom',
          external_id: externalId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
        },
      });
    }
    console.log('[ZOOM DEBUG] Zoom connection stored successfully');
    this.zoomLog('stored zoom tokens', { userId, externalId });
  }

  async isZoomConnected(userId: string): Promise<boolean> {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'zoom' },
    });
    const connected = !!(record && (record.access_token || record.refresh_token));
    this.zoomLog('isZoomConnected', { userId, connected });
    return connected;
  }

  async refreshZoomToken(userId: string): Promise<boolean> {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'zoom' },
    });
    
    if (!record || !record.refresh_token) {
      this.zoomLog('refreshZoomToken - no refresh token', { userId });
      return false;
    }

    try {
      const clientId = this.env('ZOOM_CLIENT_ID');
      const clientSecret = this.env('ZOOM_CLIENT_SECRET');
      
      if (!clientId || !clientSecret) {
        this.zoomLog('refreshZoomToken - missing env vars', { userId });
        return false;
      }

      const tokenRes = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: record.refresh_token,
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        this.zoomLog('refreshZoomToken - failed', { userId, status: tokenRes.status, error: errorText });
        return false;
      }

      const tokens = await tokenRes.json();
      this.zoomLog('refreshZoomToken - success', { userId, hasAccessToken: !!tokens.access_token, hasRefreshToken: !!tokens.refresh_token });

      await this.prisma.externalCalendar.update({
        where: { id: record.id },
        data: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || record.refresh_token, // Keep old refresh token if new one not provided
        },
      });

      return true;
    } catch (error) {
      this.zoomLog('refreshZoomToken - error', { userId, error: error.message });
      return false;
    }
  }

  async disconnectZoom(userId: string) {
    await this.prisma.externalCalendar.deleteMany({
      where: { user_id: userId, provider: 'zoom' },
    });
    this.zoomLog('disconnectZoom', { userId });
  }

  generateOutlookAuthUrl(userId: string): string {
    const url = buildOutlookAuthUrl(this.createState(userId));
    this.outlookLog('generateOutlookAuthUrl', { userId, url });
    console.log('[DEBUG] Generated Outlook OAuth URL:', url);
    return url;
  }

  async handleOutlookCallback(code: string, state: string) {
    console.log('[OUTLOOK DEBUG] handleOutlookCallback start');
    console.log('[OUTLOOK DEBUG] Code length:', code?.length);
    console.log('[OUTLOOK DEBUG] State:', state);
    
    this.outlookLog('handleOutlookCallback start', { code: code?.substring(0, 10) + '...', state });
    
    const userId = this.decodeState(state);
    const clientId = OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    const redirectUri = OUTLOOK_REDIRECT_URI;
    const tenant = OUTLOOK_TENANT;
    
    console.log('[OUTLOOK DEBUG] Environment check:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRedirectUri: !!redirectUri,
      tenant,
      redirectUri
    });
    
    if (!clientId || !clientSecret || !redirectUri) {
      this.outlookLog('missing env vars', { 
        hasClientId: !!clientId, 
        hasClientSecret: !!clientSecret, 
        hasRedirectUri: !!redirectUri 
      });
      throw new Error('Missing Outlook OAuth environment variables. Please check OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, and OUTLOOK_REDIRECT_URI.');
    }
    const tokenRes = await fetch(
      `${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      },
    );
    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('[OUTLOOK DEBUG] Token exchange failed:', tokenRes.status, errorText);
      this.outlookLog('token exchange failed', { status: tokenRes.status, error: errorText });
      throw new Error(`Failed to obtain Outlook tokens: ${tokenRes.status} - ${errorText}`);
    }
    const tokens = await tokenRes.json();
    this.outlookLog('token response', tokens);
    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string | undefined;
    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      this.outlookLog('user fetch failed', await userRes.text());
      throw new Error('Failed to fetch Outlook user info');
    }
    const userInfo = await userRes.json();
    this.outlookLog('userInfo', userInfo);
    const externalId = userInfo.id as string;
    const existing = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'outlook' },
    });
    if (existing) {
      await this.prisma.externalCalendar.update({
        where: { id: existing.id },
        data: {
          external_id: externalId,
          access_token: accessToken,
          refresh_token: refreshToken ?? existing.refresh_token,
        },
      });
    } else {
      await this.prisma.externalCalendar.create({
        data: {
          user_id: userId,
          provider: 'outlook',
          external_id: externalId,
          access_token: accessToken,
          refresh_token: refreshToken ?? null,
        },
      });
    }
    this.outlookLog('stored outlook tokens', { userId, externalId });
  }

  async isOutlookConnected(userId: string): Promise<boolean> {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'outlook' },
    });
    const connected = !!(record && (record.access_token || record.refresh_token));
    this.outlookLog('isOutlookConnected', { userId, connected });
    return connected;
  }

  async refreshOutlookToken(userId: string): Promise<boolean> {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'outlook' },
    });
    
    if (!record || !record.refresh_token) {
      this.outlookLog('refreshOutlookToken - no refresh token', { userId });
      return false;
    }

    try {
      const clientId = OUTLOOK_CLIENT_ID;
      const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
      const tenant = OUTLOOK_TENANT;
      
      if (!clientId || !clientSecret) {
        this.outlookLog('refreshOutlookToken - missing env vars', { userId });
        return false;
      }

      const tokenRes = await fetch(`${tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: record.refresh_token,
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        this.outlookLog('refreshOutlookToken - failed', { userId, status: tokenRes.status, error: errorText });
        return false;
      }

      const tokens = await tokenRes.json();
      this.outlookLog('refreshOutlookToken - success', { userId, hasAccessToken: !!tokens.access_token, hasRefreshToken: !!tokens.refresh_token });

      await this.prisma.externalCalendar.update({
        where: { id: record.id },
        data: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || record.refresh_token, // Keep old refresh token if new one not provided
        },
      });

      return true;
    } catch (error) {
      this.outlookLog('refreshOutlookToken - error', { userId, error: error.message });
      return false;
    }
  }

  async disconnectOutlook(userId: string) {
    await this.prisma.externalCalendar.deleteMany({
      where: { user_id: userId, provider: 'outlook' },
    });
    this.outlookLog('disconnectOutlook', { userId });
  }

  private async verifyAppleCredentials(
    email: string,
    password: string,
  ): Promise<'ok' | 'invalid' | 'unreachable'> {
    try {
      // DEBUG ONLY - show constructed request headers/body
      const auth = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
      const headers = {
        Depth: '0',
        Authorization: auth,
        'Content-Type': 'application/xml',
        'User-Agent': 'calendarify-caldav-test',
        Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      } as const;

      const bodyRoot =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<propfind xmlns="DAV:">\n' +
        '  <prop><current-user-principal/></prop>\n' +
        '</propfind>';
      console.log('[DEBUG] Apple root PROPFIND', { email, headers, bodyRoot });
      let res = await fetch('https://caldav.icloud.com/', {
        method: 'PROPFIND',
        headers,
        body: bodyRoot,
      });
      console.log('[DEBUG] Apple root status', res.status, res.statusText);
      let text = await res.text();
      console.log('[DEBUG] Apple root body:', text.slice(0, 200));
      if ([401, 403, 404].includes(res.status)) return 'invalid';
      if (res.status !== 207) return 'unreachable';

      const hrefMatch = text.match(/<[^>]*current-user-principal[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
      if (!hrefMatch) {
        console.log('[DEBUG] Could not parse principal href');
        return 'unreachable';
      }
      let principalUrl = hrefMatch[1].trim();
      if (principalUrl.startsWith('/')) {
        principalUrl = 'https://caldav.icloud.com' + principalUrl;
      }
      console.log('[DEBUG] Parsed principal URL', principalUrl);

      const bodyPrincipal =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">\n' +
        '  <prop><cal:calendar-home-set/></prop>\n' +
        '</propfind>';
      console.log('[DEBUG] Apple principal PROPFIND', { principalUrl, bodyPrincipal });
      res = await fetch(principalUrl, { method: 'PROPFIND', headers, body: bodyPrincipal });
      console.log('[DEBUG] Apple principal status', res.status, res.statusText);
      text = await res.text();
      console.log('[DEBUG] Apple principal body:', text.slice(0, 200));
      if ([401, 403, 404].includes(res.status)) return 'invalid';
      if (res.status !== 207) return 'unreachable';

      const homeMatch = text.match(/<[^>]*calendar-home-set[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
      if (!homeMatch) {
        console.log('[DEBUG] Could not parse calendar-home-set href');
        return 'unreachable';
      }
      let homeUrl = homeMatch[1].trim();
      if (homeUrl.startsWith('/')) {
        homeUrl = 'https://caldav.icloud.com' + homeUrl;
      }
      console.log('[DEBUG] Parsed calendar home set', homeUrl);
      return 'ok';
    } catch (err) {
      console.log('[DEBUG] verifyAppleCredentials error:', err);
      return 'unreachable';
    }
  }

  async connectAppleCalendar(userId: string, email: string, password: string) {
    // DEBUG PRINT - start connection attempt
    console.log('[DEBUG] connectAppleCalendar start', { userId, email });
    const result = await this.verifyAppleCredentials(email, password);
    // DEBUG PRINT - result of credential check
    console.log('[DEBUG] connectAppleCalendar verify result:', result);
    if (result === 'invalid') throw new BadRequestException('Invalid Apple credentials');
    if (result === 'unreachable') throw new ServiceUnavailableException('Unable to reach Apple Calendar');

    const existing = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'apple' },
    });
    if (existing) {
      await this.prisma.externalCalendar.update({
        where: { id: existing.id },
        data: {
          external_id: email,
          password,
        },
      });
    } else {
      await this.prisma.externalCalendar.create({
        data: {
          user_id: userId,
          provider: 'apple',
          external_id: email,
          password,
        },
      });
    }
  }

  async isAppleConnected(userId: string): Promise<boolean> {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'apple' },
    });
    return !!(record && record.password);
  }

  async disconnectAppleCalendar(userId: string) {
    await this.prisma.externalCalendar.deleteMany({
      where: { user_id: userId, provider: 'apple' },
    });
  }

  async getAppleCalendars(userId: string): Promise<{href: string, name: string}[]> {
    console.log('[DEBUG] getAppleCalendars called for user:', userId);
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'apple' },
    });
    
    if (!record || !record.password) {
      console.log('[DEBUG] No Apple Calendar record found for user:', userId);
      throw new BadRequestException('Apple Calendar not connected');
    }

    console.log('[DEBUG] Found Apple Calendar record for email:', record.external_id);

    try {
      const auth = 'Basic ' + Buffer.from(`${record.external_id}:${record.password}`).toString('base64');
      const headers = {
        'Depth': '0',
        'Authorization': auth,
        'Content-Type': 'application/xml',
        'User-Agent': 'calendarify-caldav',
        'Accept': 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      };

      console.log('[DEBUG] Step 1: Getting principal URL...');
      // Step 1: Get principal URL
      const principalUrl = await this.getApplePrincipalUrl(headers);
      if (!principalUrl) {
        console.log('[DEBUG] Failed to get principal URL');
        throw new Error('Could not discover Apple Calendar principal URL');
      }
      console.log('[DEBUG] Got principal URL:', principalUrl);

      console.log('[DEBUG] Step 2: Getting calendar home URL...');
      // Step 2: Get calendar home URL
      const calendarHomeUrl = await this.getAppleCalendarHomeUrl(principalUrl, headers);
      if (!calendarHomeUrl) {
        console.log('[DEBUG] Failed to get calendar home URL');
        throw new Error('Could not discover Apple Calendar home URL');
      }
      console.log('[DEBUG] Got calendar home URL:', calendarHomeUrl);

      console.log('[DEBUG] Step 3: Listing calendars...');
      // Step 3: List available calendars
      const calendars = await this.listAppleCalendars(calendarHomeUrl, headers);
      console.log('[DEBUG] Found calendars:', calendars);
      return calendars;
    } catch (error) {
      console.error('[INTEGRATIONS] Error fetching Apple calendars:', error);
      throw new BadRequestException('Failed to fetch Apple calendars');
    }
  }

  private async getApplePrincipalUrl(headers: any): Promise<string | null> {
    console.log('[DEBUG] getApplePrincipalUrl: Making PROPFIND request to caldav.icloud.com');
    const bodyRoot = `<?xml version="1.0" encoding="UTF-8"?>\n<propfind xmlns="DAV:">\n  <prop><current-user-principal/></prop>\n</propfind>`;
    const res = await fetch('https://caldav.icloud.com/', {
      method: 'PROPFIND',
      headers,
      body: bodyRoot,
    });
    console.log('[DEBUG] getApplePrincipalUrl: Response status:', res.status);
    if (![207].includes(res.status)) {
      console.log('[DEBUG] getApplePrincipalUrl: Unexpected status code, returning null');
      return null;
    }
    const text = await res.text();
    console.log('[DEBUG] getApplePrincipalUrl: Response body (first 200 chars):', text.substring(0, 200));
    const m = text.match(/<[^>]*current-user-principal[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
    if (!m) {
      console.log('[DEBUG] getApplePrincipalUrl: No principal URL found in response');
      return null;
    }
    let principalUrl = m[1].trim();
    if (principalUrl.startsWith('/')) principalUrl = 'https://caldav.icloud.com' + principalUrl;
    console.log('[DEBUG] getApplePrincipalUrl: Found principal URL:', principalUrl);
    return principalUrl;
  }

  private async getAppleCalendarHomeUrl(principalUrl: string, headers: any): Promise<string | null> {
    const bodyPrincipal = `<?xml version="1.0" encoding="UTF-8"?>\n<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">\n  <prop><cal:calendar-home-set/></prop>\n</propfind>`;
    const res = await fetch(principalUrl, {
      method: 'PROPFIND',
      headers,
      body: bodyPrincipal,
    });
    if (![207].includes(res.status)) return null;
    const text = await res.text();
    const m = text.match(/<[^>]*calendar-home-set[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
    if (!m) return null;
    let homeUrl = m[1].trim();
    if (homeUrl.startsWith('/')) homeUrl = 'https://caldav.icloud.com' + homeUrl;
    return homeUrl;
  }

  private async listAppleCalendars(calendarHomeUrl: string, headers: any): Promise<{href: string, name: string}[]> {
    console.log('[DEBUG] listAppleCalendars: Making PROPFIND request to:', calendarHomeUrl);
    const bodyCals = `<?xml version="1.0" encoding="UTF-8"?>\n<propfind xmlns="DAV:">\n  <prop><displayname/></prop>\n</propfind>`;
    const res = await fetch(calendarHomeUrl, {
      method: 'PROPFIND',
      headers: {...headers, Depth: '1'},
      body: bodyCals,
    });
    console.log('[DEBUG] listAppleCalendars: Response status:', res.status);
    if (res.status !== 207) {
      console.log('[DEBUG] listAppleCalendars: Unexpected status code, returning empty array');
      return [];
    }
    const text = await res.text();
    console.log('[DEBUG] listAppleCalendars: Response body (first 500 chars):', text.substring(0, 500));
    
    // Parse calendar list
    const calendars: {href: string, name: string}[] = [];
    const regex = /<response[^>]*>.*?<href>([^<]+)<\/href>.*?<displayname[^>]*>([^<]*)<\/displayname>/gs;
    let m;
    while ((m = regex.exec(text))) {
      console.log('[DEBUG] listAppleCalendars: Found potential calendar:', m[1], m[2]);
      console.log('[DEBUG] listAppleCalendars: href ends with /calendars/:', m[1].endsWith("/calendars/"));
      console.log('[DEBUG] listAppleCalendars: name is empty:', m[2].trim() === "");
      // Filter out system folders and containers
      const skip = ["inbox", "outbox", "notification", ""].some(s => 
        m[2].trim().toLowerCase() === s
      ) || (m[1].endsWith("/calendars/") && m[2].trim() === ""); // Only skip the root calendars folder if it has no name
      if (!skip) {
        calendars.push({ href: m[1], name: m[2].trim() });
        console.log('[DEBUG] listAppleCalendars: Added calendar:', m[2].trim());
      } else {
        console.log('[DEBUG] listAppleCalendars: Skipped calendar:', m[2].trim());
      }
    }
    
    console.log('[DEBUG] listAppleCalendars: Final calendar list:', calendars);
    return calendars;
  }

  async updateAppleCalendarSelection(userId: string, selectedCalendars: string[]) {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'apple' },
    });
    
    if (!record) {
      throw new BadRequestException('Apple Calendar not connected');
    }

    await this.prisma.externalCalendar.update({
      where: { id: record.id },
      data: {
        selected_calendars: selectedCalendars,
      },
    });
  }

  private async fetchAppleCalendars(email: string, password: string) {
    const auth = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
    const headers = {
      Depth: '0',
      Authorization: auth,
      'Content-Type': 'application/xml',
      'User-Agent': 'calendarify-caldav-test',
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
    } as const;

    const bodyRoot =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<propfind xmlns="DAV:">\n' +
      '  <prop><current-user-principal/></prop>\n' +
      '</propfind>';
    console.log('[DEBUG] fetchAppleCalendars root request', { email, headers });
    let res: any, text: string;
    try {
      res = await fetch('https://caldav.icloud.com/', {
        method: 'PROPFIND',
        headers,
        body: bodyRoot,
      });
      console.log('[DEBUG] fetchAppleCalendars root status', res.status, res.statusText);
      text = await res.text();
      console.log('[DEBUG] fetchAppleCalendars root body', text.slice(0, 200));
    } catch (err) {
      console.log('[DEBUG] fetchAppleCalendars root error', err);
      return null;
    }
    if (res.status !== 207) return null;
    const hrefMatch = text.match(/<[^>]*current-user-principal[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
    if (!hrefMatch) return null;
    let principalUrl = hrefMatch[1].trim();
    if (principalUrl.startsWith('/')) {
      principalUrl = 'https://caldav.icloud.com' + principalUrl;
    }

    const bodyPrincipal =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">\n' +
      '  <prop><cal:calendar-home-set/></prop>\n' +
      '</propfind>';
    console.log('[DEBUG] fetchAppleCalendars principal request', { principalUrl });
    try {
      res = await fetch(principalUrl, { method: 'PROPFIND', headers, body: bodyPrincipal });
      console.log('[DEBUG] fetchAppleCalendars principal status', res.status, res.statusText);
      text = await res.text();
      console.log('[DEBUG] fetchAppleCalendars principal body', text.slice(0, 200));
    } catch (err) {
      console.log('[DEBUG] fetchAppleCalendars principal error', err);
      return null;
    }
    if (res.status !== 207) return null;
    const homeMatch = text.match(/<[^>]*calendar-home-set[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
    if (!homeMatch) return null;
    let homeUrl = homeMatch[1].trim();
    if (homeUrl.startsWith('/')) {
      homeUrl = 'https://caldav.icloud.com' + homeUrl;
    }

    const bodyCals =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<propfind xmlns="DAV:">\n' +
      '  <prop><displayname/></prop>\n' +
      '</propfind>';
    console.log('[DEBUG] fetchAppleCalendars list request', { homeUrl });
    try {
      res = await fetch(homeUrl, { method: 'PROPFIND', headers: { ...headers, Depth: '1' }, body: bodyCals });
      console.log('[DEBUG] fetchAppleCalendars list status', res.status, res.statusText);
      text = await res.text();
      console.log('[DEBUG] fetchAppleCalendars list body', text.slice(0, 200));
    } catch (err) {
      console.log('[DEBUG] fetchAppleCalendars list error', err);
      return null;
    }
    if (res.status !== 207) return null;
    const cals: { href: string; name: string }[] = [];
    const regex = /<response[^>]*>.*?<href>([^<]+)<\/href>.*?<displayname[^>]*>([^<]*)<\/displayname>/gs;
    let m;
    while ((m = regex.exec(text))) {
      cals.push({ href: m[1], name: m[2] });
    }
    console.log('[DEBUG] fetchAppleCalendars parsed calendars', cals);
    return cals;
  }



  generateZoomAuthUrl(userId: string): string {
    console.log('[ZOOM DEBUG] Generating auth URL for user:', userId);
    const clientId = this.env('ZOOM_CLIENT_ID');
    const redirectUri = this.env('ZOOM_REDIRECT_URI');
    // For web server OAuth, omit PKCE to avoid Zoom 4700 issues on some app configs
    const state = this.createStatePayload({ sub: userId });
    const base = 'https://zoom.us/oauth/authorize';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId ?? '',
      redirect_uri: redirectUri ?? '',
      state,
    });
    const accountId = this.env('ZOOM_ACCOUNT_ID');
    if (accountId) {
      params.set('account_id', accountId);
    }
    const url = `${base}?${params.toString()}`;
    this.zoomLog('generateZoomAuthUrl', { userId, url, clientId, redirectUri, accountIdPresent: !!accountId });
    console.log('[ZOOM DEBUG] Generated OAuth URL:', url);
    console.log('[ZOOM DEBUG] Client ID:', clientId);
    console.log('[ZOOM DEBUG] Redirect URI:', redirectUri);
    console.log('[ZOOM DEBUG] Note: PKCE disabled for Zoom Web OAuth flow');
    console.log('[ZOOM DEBUG] State:', state);
    return url;
  }
}

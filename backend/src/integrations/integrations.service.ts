import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma.service';
import { sign, verify } from 'jsonwebtoken';
import { appendFileSync } from 'fs';
import * as path from 'path';

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

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

  connectGoogleMeet(data: any) {
    return { message: 'google meet integration stub', data };
  }

  async handleZoomCallback(code: string, state: string) {
    console.log('[DEBUG] handleZoomCallback code:', code);
    this.zoomLog('handleZoomCallback start', { code, state });
    const userId = this.decodeState(state);
    const clientId = this.env('ZOOM_CLIENT_ID');
    const clientSecret = this.env('ZOOM_CLIENT_SECRET');
    const redirectUri = this.env('ZOOM_REDIRECT_URI');
    console.log('[DEBUG] handleZoomCallback redirect_uri:', redirectUri);
    if (!clientId || !clientSecret || !redirectUri) {
      this.zoomLog('missing env vars', { clientId, clientSecret, redirectUri });
      throw new Error('Missing Zoom OAuth environment variables');
    }
    // Exchange code for access token
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
      }),
    });
    if (!tokenRes.ok) {
      this.zoomLog('token exchange failed', await tokenRes.text());
      throw new Error('Failed to obtain Zoom tokens');
    }
    const tokens = await tokenRes.json();
    this.zoomLog('token response', tokens);
    // Get user info from Zoom
    const userRes = await fetch('https://api.zoom.us/v2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });
    if (!userRes.ok) {
      this.zoomLog('user fetch failed', await userRes.text());
      throw new Error('Failed to fetch Zoom user info');
    }
    const userInfo = await userRes.json();
    this.zoomLog('userInfo', userInfo);
    const externalId = userInfo.id;
    // Store in DB
    const existing = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'zoom' },
    });
    if (existing) {
      await this.prisma.externalCalendar.update({
        where: { id: existing.id },
        data: {
          external_id: externalId,
          access_token: tokens.access_token,
        },
      });
    } else {
      await this.prisma.externalCalendar.create({
        data: {
          user_id: userId,
          provider: 'zoom',
          external_id: externalId,
          access_token: tokens.access_token,
        },
      });
    }
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

  async disconnectZoom(userId: string) {
    await this.prisma.externalCalendar.deleteMany({
      where: { user_id: userId, provider: 'zoom' },
    });
    this.zoomLog('disconnectZoom', { userId });
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
        'User-Agent': 'calendarify-caldav',
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
      const principalUrl = 'https://caldav.icloud.com' + hrefMatch[1].trim();
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
      console.log('[DEBUG] Parsed calendar home set', homeMatch[1].trim());

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

  private async fetchAppleCalendars(email: string, password: string) {
    const auth = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
    const headers = {
      Depth: '0',
      Authorization: auth,
      'Content-Type': 'application/xml',
      'User-Agent': 'calendarify-caldav',
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
    } as const;

    const bodyRoot =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<propfind xmlns="DAV:">\n' +
      '  <prop><current-user-principal/></prop>\n' +
      '</propfind>';
    let res = await fetch('https://caldav.icloud.com/', {
      method: 'PROPFIND',
      headers,
      body: bodyRoot,
    });
    if (res.status !== 207) return null;
    let text = await res.text();
    const hrefMatch = text.match(/<[^>]*current-user-principal[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
    if (!hrefMatch) return null;
    const principalUrl = 'https://caldav.icloud.com' + hrefMatch[1].trim();

    const bodyPrincipal =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">\n' +
      '  <prop><cal:calendar-home-set/></prop>\n' +
      '</propfind>';
    res = await fetch(principalUrl, { method: 'PROPFIND', headers, body: bodyPrincipal });
    if (res.status !== 207) return null;
    text = await res.text();
    const homeMatch = text.match(/<[^>]*calendar-home-set[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
    if (!homeMatch) return null;
    const homeUrl = 'https://caldav.icloud.com' + homeMatch[1].trim();

    const bodyCals =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<propfind xmlns="DAV:">\n' +
      '  <prop><displayname/></prop>\n' +
      '</propfind>';
    res = await fetch(homeUrl, { method: 'PROPFIND', headers: { ...headers, Depth: '1' }, body: bodyCals });
    if (res.status !== 207) return null;
    text = await res.text();
    const cals: { href: string; name: string }[] = [];
    const regex = /<D:response>\s*<D:href>([^<]+)<\/D:href>[\s\S]*?<D:displayname>([^<]*)<\/D:displayname>/gi;
    let m;
    while ((m = regex.exec(text))) {
      cals.push({ href: m[1], name: m[2] });
    }
    return cals;
  }

  async listAppleCalendars(userId: string) {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'apple' },
    });
    if (!record || !record.password) {
      throw new BadRequestException('Apple Calendar not connected');
    }
    const cals = await this.fetchAppleCalendars(record.external_id, record.password);
    if (!cals) throw new ServiceUnavailableException('Unable to reach Apple Calendar');
    return cals;
  }

  async selectAppleCalendar(userId: string, href: string) {
    const record = await this.prisma.externalCalendar.findFirst({
      where: { user_id: userId, provider: 'apple' },
    });
    if (!record) throw new BadRequestException('Apple Calendar not connected');
    await this.prisma.externalCalendar.update({
      where: { id: record.id },
      data: { selected_calendar: href },
    });
  }

  generateZoomAuthUrl(userId: string): string {
    const clientId = this.env('ZOOM_CLIENT_ID');
    const redirectUri = this.env('ZOOM_REDIRECT_URI');
    const state = this.createState(userId);
    const base = 'https://zoom.us/oauth/authorize';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId ?? '',
      redirect_uri: redirectUri ?? '',
      state,
    });
    const url = `${base}?${params.toString()}`;
    this.zoomLog('generateZoomAuthUrl', { userId, url });
    console.log('[DEBUG] Generated Zoom OAuth URL:', url);
    return url;
  }
}

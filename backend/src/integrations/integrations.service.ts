import { BadRequestException, Injectable } from '@nestjs/common';
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
    const clientId = process.env.ZOOM_CLIENT_ID?.trim();
    const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim();
    const redirectUri = process.env.ZOOM_REDIRECT_URI?.trim();
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

  generateZoomAuthUrl(userId: string): string {
    const clientId = process.env.ZOOM_CLIENT_ID?.trim();
    const redirectUri = process.env.ZOOM_REDIRECT_URI?.trim();
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

import { BadRequestException, Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma.service';
import { sign, verify } from 'jsonwebtoken';

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

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

  connectZoom(data: any) {
    return { message: 'zoom integration stub', data };
  }
}

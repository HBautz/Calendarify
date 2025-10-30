"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsService = void 0;
exports.buildOutlookAuthUrl = buildOutlookAuthUrl;
const common_1 = require("@nestjs/common");
const googleapis_1 = require("googleapis");
const prisma_service_1 = require("../prisma.service");
const jsonwebtoken_1 = require("jsonwebtoken");
const fs_1 = require("fs");
const crypto = require("crypto");
const path = require("path");
require("dotenv/config");
const node_fetch_1 = require("node-fetch");
const DEFAULT_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
];
const OUTLOOK_TENANT = process.env.OUTLOOK_OAUTH_TENANT ||
    'https://login.microsoftonline.com/common';
const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID;
const OUTLOOK_REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI;
const OUTLOOK_SCOPE = 'User.Read Calendars.ReadWrite Calendars.ReadWrite.Shared ' +
    'MailboxSettings.Read OnlineMeetings.ReadWrite offline_access';
function buildOutlookAuthUrl(state) {
    return (OUTLOOK_TENANT + '/oauth2/v2.0/authorize' +
        '?client_id=' + encodeURIComponent(OUTLOOK_CLIENT_ID ?? '') +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(OUTLOOK_REDIRECT_URI ?? '') +
        '&scope=' + encodeURIComponent(OUTLOOK_SCOPE) +
        '&response_mode=query' +
        '&prompt=consent' +
        '&state=' + state);
}
let IntegrationsService = class IntegrationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    zoomLog(...msgs) {
        const logPath = path.join(process.cwd(), 'zoom_debug.log');
        const line = `[${new Date().toISOString()}] ` + msgs.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ') + '\n';
        try {
            (0, fs_1.appendFileSync)(logPath, line);
        }
        catch (err) {
            console.error('Failed to write zoom log', err);
        }
    }
    outlookLog(...msgs) {
        const logPath = path.join(process.cwd(), 'outlook_debug.log');
        const line = `[${new Date().toISOString()}] ` + msgs.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ') + '\n';
        try {
            (0, fs_1.appendFileSync)(logPath, line);
        }
        catch (err) {
            console.error('Failed to write outlook log', err);
        }
    }
    env(name) {
        const val = process.env[name];
        return val ? val.split('#')[0].trim() : undefined;
    }
    oauthClient() {
        return new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET', process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/integrations/google/callback');
    }
    createStatePayload(payload) {
        return (0, jsonwebtoken_1.sign)(payload, process.env.JWT_SECRET || 'changeme', {
            expiresIn: '10m',
        });
    }
    decodeStatePayload(state) {
        try {
            return (0, jsonwebtoken_1.verify)(state, process.env.JWT_SECRET || 'changeme');
        }
        catch {
            throw new common_1.BadRequestException('Invalid OAuth state');
        }
    }
    generateCodeVerifier() {
        return crypto.randomBytes(32).toString('base64url');
    }
    computeCodeChallenge(verifier) {
        const hash = crypto.createHash('sha256').update(verifier).digest('base64');
        return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    createState(userId) {
        return (0, jsonwebtoken_1.sign)({ sub: userId }, process.env.JWT_SECRET || 'changeme', {
            expiresIn: '10m',
        });
    }
    decodeState(state) {
        try {
            const payload = (0, jsonwebtoken_1.verify)(state, process.env.JWT_SECRET || 'changeme');
            return payload.sub;
        }
        catch {
            throw new common_1.BadRequestException('Invalid OAuth state');
        }
    }
    generateGoogleAuthUrl(userId) {
        const client = this.oauthClient();
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: DEFAULT_SCOPES,
            state: this.createState(userId),
            prompt: 'consent',
        });
    }
    async handleGoogleCallback(code, state) {
        const userId = this.decodeState(state);
        const client = this.oauthClient();
        let tokens;
        try {
            const tokenResponse = await client.getToken(code);
            tokens = tokenResponse.tokens;
        }
        catch (err) {
            throw err;
        }
        client.setCredentials(tokens);
        const oauth2 = googleapis_1.google.oauth2({ version: 'v2', auth: client });
        let data;
        try {
            const userInfo = await oauth2.userinfo.get();
            data = userInfo.data;
        }
        catch (err) {
            throw err;
        }
        const externalId = data.id ?? '';
        try {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (user && user.email) {
                console.log(`"${user.email}" Tried to connect "Google Calendar" and it was "Successful"`);
            }
        }
        catch (e) {
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
        }
        else {
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
    async getGoogleCalendar(userId) {
        const record = await this.prisma.externalCalendar.findFirst({
            where: { user_id: userId, provider: 'google' },
        });
        if (!record)
            return null;
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
        return googleapis_1.google.calendar({ version: 'v3', auth: client });
    }
    async listGoogleEvents(userId, timeMin, timeMax) {
        const calendar = await this.getGoogleCalendar(userId);
        if (!calendar)
            return [];
        const res = await calendar.events.list({
            calendarId: 'primary',
            singleEvents: true,
            timeMin,
            timeMax,
        });
        return res.data.items ?? [];
    }
    async disconnectGoogle(userId) {
        await this.prisma.externalCalendar.deleteMany({
            where: { user_id: userId, provider: 'google' },
        });
    }
    async isGoogleConnected(userId) {
        const record = await this.prisma.externalCalendar.findFirst({
            where: { user_id: userId, provider: 'google' },
        });
        return !!(record && (record.access_token || record.refresh_token));
    }
    async refreshGoogleToken(userId) {
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
                    refresh_token: credentials.refresh_token || record.refresh_token,
                },
            });
            return true;
        }
        catch (error) {
            console.error('[GOOGLE DEBUG] refreshGoogleToken - error', { userId, error: error.message });
            return false;
        }
    }
    connectGoogleMeet(data) {
        return { message: 'google meet integration stub', data };
    }
    async handleZoomCallback(code, state) {
        console.log('[ZOOM DEBUG] handleZoomCallback called at:', new Date().toISOString());
        console.log('[ZOOM DEBUG] Code:', code);
        console.log('[ZOOM DEBUG] State:', state);
        this.zoomLog('handleZoomCallback start', { code, state });
        const decoded = this.decodeStatePayload(state);
        const userId = decoded?.sub;
        const codeVerifier = decoded?.zcv;
        console.log('[ZOOM DEBUG] Decoded userId:', userId);
        const clientId = this.env('ZOOM_CLIENT_ID');
        const clientSecret = this.env('ZOOM_CLIENT_SECRET');
        const redirectUri = this.env('ZOOM_REDIRECT_URI');
        console.log('[ZOOM DEBUG] OAuth config:', { clientId, redirectUri, hasSecret: !!clientSecret });
        if (!clientId || !clientSecret || !redirectUri) {
            this.zoomLog('missing env vars', { clientId, clientSecret, redirectUri });
            throw new Error('Missing Zoom OAuth environment variables');
        }
        console.log('[ZOOM DEBUG] Exchanging code for token...');
        const tokenRes = await (0, node_fetch_1.default)('https://zoom.us/oauth/token', {
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
        console.log('[ZOOM DEBUG] Fetching user info from Zoom...');
        const userRes = await (0, node_fetch_1.default)('https://api.zoom.us/v2/users/me', {
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
        }
        else {
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
    async isZoomConnected(userId) {
        const record = await this.prisma.externalCalendar.findFirst({
            where: { user_id: userId, provider: 'zoom' },
        });
        const connected = !!(record && (record.access_token || record.refresh_token));
        this.zoomLog('isZoomConnected', { userId, connected });
        return connected;
    }
    async refreshZoomToken(userId) {
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
            const tokenRes = await (0, node_fetch_1.default)('https://zoom.us/oauth/token', {
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
                    refresh_token: tokens.refresh_token || record.refresh_token,
                },
            });
            return true;
        }
        catch (error) {
            this.zoomLog('refreshZoomToken - error', { userId, error: error.message });
            return false;
        }
    }
    async disconnectZoom(userId) {
        await this.prisma.externalCalendar.deleteMany({
            where: { user_id: userId, provider: 'zoom' },
        });
        this.zoomLog('disconnectZoom', { userId });
    }
    generateOutlookAuthUrl(userId) {
        const url = buildOutlookAuthUrl(this.createState(userId));
        this.outlookLog('generateOutlookAuthUrl', { userId, url });
        console.log('[DEBUG] Generated Outlook OAuth URL:', url);
        return url;
    }
    async handleOutlookCallback(code, state) {
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
        const tokenRes = await (0, node_fetch_1.default)(`${tenant}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }),
        });
        if (!tokenRes.ok) {
            const errorText = await tokenRes.text();
            console.error('[OUTLOOK DEBUG] Token exchange failed:', tokenRes.status, errorText);
            this.outlookLog('token exchange failed', { status: tokenRes.status, error: errorText });
            throw new Error(`Failed to obtain Outlook tokens: ${tokenRes.status} - ${errorText}`);
        }
        const tokens = await tokenRes.json();
        this.outlookLog('token response', tokens);
        const accessToken = tokens.access_token;
        const refreshToken = tokens.refresh_token;
        const userRes = await (0, node_fetch_1.default)('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!userRes.ok) {
            this.outlookLog('user fetch failed', await userRes.text());
            throw new Error('Failed to fetch Outlook user info');
        }
        const userInfo = await userRes.json();
        this.outlookLog('userInfo', userInfo);
        const externalId = userInfo.id;
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
        }
        else {
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
    async isOutlookConnected(userId) {
        const record = await this.prisma.externalCalendar.findFirst({
            where: { user_id: userId, provider: 'outlook' },
        });
        const connected = !!(record && (record.access_token || record.refresh_token));
        this.outlookLog('isOutlookConnected', { userId, connected });
        return connected;
    }
    async refreshOutlookToken(userId) {
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
            const tokenRes = await (0, node_fetch_1.default)(`${tenant}/oauth2/v2.0/token`, {
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
                    refresh_token: tokens.refresh_token || record.refresh_token,
                },
            });
            return true;
        }
        catch (error) {
            this.outlookLog('refreshOutlookToken - error', { userId, error: error.message });
            return false;
        }
    }
    async disconnectOutlook(userId) {
        await this.prisma.externalCalendar.deleteMany({
            where: { user_id: userId, provider: 'outlook' },
        });
        this.outlookLog('disconnectOutlook', { userId });
    }
    async verifyAppleCredentials(email, password) {
        try {
            const auth = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
            const headers = {
                Depth: '0',
                Authorization: auth,
                'Content-Type': 'application/xml',
                'User-Agent': 'calendarify-caldav-test',
                Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
            };
            const bodyRoot = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<propfind xmlns="DAV:">\n' +
                '  <prop><current-user-principal/></prop>\n' +
                '</propfind>';
            console.log('[DEBUG] Apple root PROPFIND', { email, headers, bodyRoot });
            let res = await (0, node_fetch_1.default)('https://caldav.icloud.com/', {
                method: 'PROPFIND',
                headers,
                body: bodyRoot,
            });
            console.log('[DEBUG] Apple root status', res.status, res.statusText);
            let text = await res.text();
            console.log('[DEBUG] Apple root body:', text.slice(0, 200));
            if ([401, 403, 404].includes(res.status))
                return 'invalid';
            if (res.status !== 207)
                return 'unreachable';
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
            const bodyPrincipal = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">\n' +
                '  <prop><cal:calendar-home-set/></prop>\n' +
                '</propfind>';
            console.log('[DEBUG] Apple principal PROPFIND', { principalUrl, bodyPrincipal });
            res = await (0, node_fetch_1.default)(principalUrl, { method: 'PROPFIND', headers, body: bodyPrincipal });
            console.log('[DEBUG] Apple principal status', res.status, res.statusText);
            text = await res.text();
            console.log('[DEBUG] Apple principal body:', text.slice(0, 200));
            if ([401, 403, 404].includes(res.status))
                return 'invalid';
            if (res.status !== 207)
                return 'unreachable';
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
        }
        catch (err) {
            console.log('[DEBUG] verifyAppleCredentials error:', err);
            return 'unreachable';
        }
    }
    async connectAppleCalendar(userId, email, password) {
        console.log('[DEBUG] connectAppleCalendar start', { userId, email });
        const result = await this.verifyAppleCredentials(email, password);
        console.log('[DEBUG] connectAppleCalendar verify result:', result);
        if (result === 'invalid')
            throw new common_1.BadRequestException('Invalid Apple credentials');
        if (result === 'unreachable')
            throw new common_1.ServiceUnavailableException('Unable to reach Apple Calendar');
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
        }
        else {
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
    async isAppleConnected(userId) {
        const record = await this.prisma.externalCalendar.findFirst({
            where: { user_id: userId, provider: 'apple' },
        });
        return !!(record && record.password);
    }
    async disconnectAppleCalendar(userId) {
        await this.prisma.externalCalendar.deleteMany({
            where: { user_id: userId, provider: 'apple' },
        });
    }
    async getAppleCalendars(userId) {
        console.log('[DEBUG] getAppleCalendars called for user:', userId);
        const record = await this.prisma.externalCalendar.findFirst({
            where: { user_id: userId, provider: 'apple' },
        });
        if (!record || !record.password) {
            console.log('[DEBUG] No Apple Calendar record found for user:', userId);
            throw new common_1.BadRequestException('Apple Calendar not connected');
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
            const principalUrl = await this.getApplePrincipalUrl(headers);
            if (!principalUrl) {
                console.log('[DEBUG] Failed to get principal URL');
                throw new Error('Could not discover Apple Calendar principal URL');
            }
            console.log('[DEBUG] Got principal URL:', principalUrl);
            console.log('[DEBUG] Step 2: Getting calendar home URL...');
            const calendarHomeUrl = await this.getAppleCalendarHomeUrl(principalUrl, headers);
            if (!calendarHomeUrl) {
                console.log('[DEBUG] Failed to get calendar home URL');
                throw new Error('Could not discover Apple Calendar home URL');
            }
            console.log('[DEBUG] Got calendar home URL:', calendarHomeUrl);
            console.log('[DEBUG] Step 3: Listing calendars...');
            const calendars = await this.listAppleCalendars(calendarHomeUrl, headers);
            console.log('[DEBUG] Found calendars:', calendars);
            return calendars;
        }
        catch (error) {
            console.error('[INTEGRATIONS] Error fetching Apple calendars:', error);
            throw new common_1.BadRequestException('Failed to fetch Apple calendars');
        }
    }
    async getApplePrincipalUrl(headers) {
        console.log('[DEBUG] getApplePrincipalUrl: Making PROPFIND request to caldav.icloud.com');
        const bodyRoot = `<?xml version="1.0" encoding="UTF-8"?>\n<propfind xmlns="DAV:">\n  <prop><current-user-principal/></prop>\n</propfind>`;
        const res = await (0, node_fetch_1.default)('https://caldav.icloud.com/', {
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
        if (principalUrl.startsWith('/'))
            principalUrl = 'https://caldav.icloud.com' + principalUrl;
        console.log('[DEBUG] getApplePrincipalUrl: Found principal URL:', principalUrl);
        return principalUrl;
    }
    async getAppleCalendarHomeUrl(principalUrl, headers) {
        const bodyPrincipal = `<?xml version="1.0" encoding="UTF-8"?>\n<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">\n  <prop><cal:calendar-home-set/></prop>\n</propfind>`;
        const res = await (0, node_fetch_1.default)(principalUrl, {
            method: 'PROPFIND',
            headers,
            body: bodyPrincipal,
        });
        if (![207].includes(res.status))
            return null;
        const text = await res.text();
        const m = text.match(/<[^>]*calendar-home-set[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
        if (!m)
            return null;
        let homeUrl = m[1].trim();
        if (homeUrl.startsWith('/'))
            homeUrl = 'https://caldav.icloud.com' + homeUrl;
        return homeUrl;
    }
    async listAppleCalendars(calendarHomeUrl, headers) {
        console.log('[DEBUG] listAppleCalendars: Making PROPFIND request to:', calendarHomeUrl);
        const bodyCals = `<?xml version="1.0" encoding="UTF-8"?>\n<propfind xmlns="DAV:">\n  <prop><displayname/></prop>\n</propfind>`;
        const res = await (0, node_fetch_1.default)(calendarHomeUrl, {
            method: 'PROPFIND',
            headers: { ...headers, Depth: '1' },
            body: bodyCals,
        });
        console.log('[DEBUG] listAppleCalendars: Response status:', res.status);
        if (res.status !== 207) {
            console.log('[DEBUG] listAppleCalendars: Unexpected status code, returning empty array');
            return [];
        }
        const text = await res.text();
        console.log('[DEBUG] listAppleCalendars: Response body (first 500 chars):', text.substring(0, 500));
        const calendars = [];
        const regex = /<response[^>]*>.*?<href>([^<]+)<\/href>.*?<displayname[^>]*>([^<]*)<\/displayname>/gs;
        let m;
        while ((m = regex.exec(text))) {
            console.log('[DEBUG] listAppleCalendars: Found potential calendar:', m[1], m[2]);
            console.log('[DEBUG] listAppleCalendars: href ends with /calendars/:', m[1].endsWith("/calendars/"));
            console.log('[DEBUG] listAppleCalendars: name is empty:', m[2].trim() === "");
            const skip = ["inbox", "outbox", "notification", ""].some(s => m[2].trim().toLowerCase() === s) || (m[1].endsWith("/calendars/") && m[2].trim() === "");
            if (!skip) {
                calendars.push({ href: m[1], name: m[2].trim() });
                console.log('[DEBUG] listAppleCalendars: Added calendar:', m[2].trim());
            }
            else {
                console.log('[DEBUG] listAppleCalendars: Skipped calendar:', m[2].trim());
            }
        }
        console.log('[DEBUG] listAppleCalendars: Final calendar list:', calendars);
        return calendars;
    }
    async updateAppleCalendarSelection(userId, selectedCalendars) {
        const record = await this.prisma.externalCalendar.findFirst({
            where: { user_id: userId, provider: 'apple' },
        });
        if (!record) {
            throw new common_1.BadRequestException('Apple Calendar not connected');
        }
        await this.prisma.externalCalendar.update({
            where: { id: record.id },
            data: {
                selected_calendars: selectedCalendars,
            },
        });
    }
    async fetchAppleCalendars(email, password) {
        const auth = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
        const headers = {
            Depth: '0',
            Authorization: auth,
            'Content-Type': 'application/xml',
            'User-Agent': 'calendarify-caldav-test',
            Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
        };
        const bodyRoot = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<propfind xmlns="DAV:">\n' +
            '  <prop><current-user-principal/></prop>\n' +
            '</propfind>';
        console.log('[DEBUG] fetchAppleCalendars root request', { email, headers });
        let res, text;
        try {
            res = await (0, node_fetch_1.default)('https://caldav.icloud.com/', {
                method: 'PROPFIND',
                headers,
                body: bodyRoot,
            });
            console.log('[DEBUG] fetchAppleCalendars root status', res.status, res.statusText);
            text = await res.text();
            console.log('[DEBUG] fetchAppleCalendars root body', text.slice(0, 200));
        }
        catch (err) {
            console.log('[DEBUG] fetchAppleCalendars root error', err);
            return null;
        }
        if (res.status !== 207)
            return null;
        const hrefMatch = text.match(/<[^>]*current-user-principal[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
        if (!hrefMatch)
            return null;
        let principalUrl = hrefMatch[1].trim();
        if (principalUrl.startsWith('/')) {
            principalUrl = 'https://caldav.icloud.com' + principalUrl;
        }
        const bodyPrincipal = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">\n' +
            '  <prop><cal:calendar-home-set/></prop>\n' +
            '</propfind>';
        console.log('[DEBUG] fetchAppleCalendars principal request', { principalUrl });
        try {
            res = await (0, node_fetch_1.default)(principalUrl, { method: 'PROPFIND', headers, body: bodyPrincipal });
            console.log('[DEBUG] fetchAppleCalendars principal status', res.status, res.statusText);
            text = await res.text();
            console.log('[DEBUG] fetchAppleCalendars principal body', text.slice(0, 200));
        }
        catch (err) {
            console.log('[DEBUG] fetchAppleCalendars principal error', err);
            return null;
        }
        if (res.status !== 207)
            return null;
        const homeMatch = text.match(/<[^>]*calendar-home-set[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
        if (!homeMatch)
            return null;
        let homeUrl = homeMatch[1].trim();
        if (homeUrl.startsWith('/')) {
            homeUrl = 'https://caldav.icloud.com' + homeUrl;
        }
        const bodyCals = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<propfind xmlns="DAV:">\n' +
            '  <prop><displayname/></prop>\n' +
            '</propfind>';
        console.log('[DEBUG] fetchAppleCalendars list request', { homeUrl });
        try {
            res = await (0, node_fetch_1.default)(homeUrl, { method: 'PROPFIND', headers: { ...headers, Depth: '1' }, body: bodyCals });
            console.log('[DEBUG] fetchAppleCalendars list status', res.status, res.statusText);
            text = await res.text();
            console.log('[DEBUG] fetchAppleCalendars list body', text.slice(0, 200));
        }
        catch (err) {
            console.log('[DEBUG] fetchAppleCalendars list error', err);
            return null;
        }
        if (res.status !== 207)
            return null;
        const cals = [];
        const regex = /<response[^>]*>.*?<href>([^<]+)<\/href>.*?<displayname[^>]*>([^<]*)<\/displayname>/gs;
        let m;
        while ((m = regex.exec(text))) {
            cals.push({ href: m[1], name: m[2] });
        }
        console.log('[DEBUG] fetchAppleCalendars parsed calendars', cals);
        return cals;
    }
    generateZoomAuthUrl(userId) {
        console.log('[ZOOM DEBUG] Generating auth URL for user:', userId);
        const clientId = this.env('ZOOM_CLIENT_ID');
        const redirectUri = this.env('ZOOM_REDIRECT_URI');
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
};
exports.IntegrationsService = IntegrationsService;
exports.IntegrationsService = IntegrationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IntegrationsService);
//# sourceMappingURL=integrations.service.js.map
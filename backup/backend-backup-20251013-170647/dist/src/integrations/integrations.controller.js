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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const integrations_service_1 = require("./integrations.service");
let IntegrationsController = class IntegrationsController {
    integrationsService;
    constructor(integrationsService) {
        this.integrationsService = integrationsService;
    }
    googleAuthUrl(req) {
        const url = this.integrationsService.generateGoogleAuthUrl(req.user.userId);
        return { url };
    }
    async googleCallback(code, state, res) {
        await this.integrationsService.handleGoogleCallback(code, state);
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${baseUrl}/dashboard`);
    }
    async googleEvents(req, timeMin, timeMax) {
        const events = await this.integrationsService.listGoogleEvents(req.user.userId, timeMin, timeMax);
        return { events };
    }
    async googleStatus(req) {
        const connected = await this.integrationsService.isGoogleConnected(req.user.userId);
        return { connected };
    }
    googleMeet(body) {
        return this.integrationsService.connectGoogleMeet(body);
    }
    zoomAuthUrl(req) {
        console.log('[ZOOM DEBUG] Auth URL requested by user:', req.user.userId);
        console.log('[ZOOM DEBUG] Request headers:', req.headers);
        const url = this.integrationsService.generateZoomAuthUrl(req.user.userId);
        console.log('[ZOOM DEBUG] Generated auth URL:', url);
        try {
            const u = new URL(url);
            console.log('[ZOOM DEBUG] Auth URL params:', {
                client_id: u.searchParams.get('client_id'),
                redirect_uri: u.searchParams.get('redirect_uri'),
                has_code_challenge: !!u.searchParams.get('code_challenge'),
                code_challenge_method: u.searchParams.get('code_challenge_method'),
                prompt: u.searchParams.get('prompt'),
            });
        }
        catch { }
        return { url };
    }
    outlookAuthUrl(req) {
        const url = this.integrationsService.generateOutlookAuthUrl(req.user.userId);
        return { url };
    }
    async zoomStatus(req) {
        const connected = await this.integrationsService.isZoomConnected(req.user.userId);
        return { connected };
    }
    async outlookStatus(req) {
        const connected = await this.integrationsService.isOutlookConnected(req.user.userId);
        return { connected };
    }
    async disconnectZoom(req) {
        await this.integrationsService.disconnectZoom(req.user.userId);
        return { message: 'Zoom disconnected' };
    }
    async disconnectOutlook(req) {
        await this.integrationsService.disconnectOutlook(req.user.userId);
        return { message: 'Outlook disconnected' };
    }
    async connectApple(req, body) {
        await this.integrationsService.connectAppleCalendar(req.user.userId, body.email, body.password);
        return { message: 'Apple Calendar connected' };
    }
    async appleStatus(req) {
        const connected = await this.integrationsService.isAppleConnected(req.user.userId);
        return { connected };
    }
    async disconnectApple(req) {
        await this.integrationsService.disconnectAppleCalendar(req.user.userId);
        return { message: 'Apple Calendar disconnected' };
    }
    async appleCalendars(req) {
        const calendars = await this.integrationsService.getAppleCalendars(req.user.userId);
        return { calendars };
    }
    async selectApple(req, selectedCalendars) {
        await this.integrationsService.updateAppleCalendarSelection(req.user.userId, selectedCalendars);
        return { message: 'Apple calendars updated' };
    }
    async disconnectGoogle(req) {
        await this.integrationsService.disconnectGoogle(req.user.userId);
        return { message: 'Google Calendar disconnected' };
    }
    testZoomCallback() {
        console.log('[ZOOM DEBUG] Test callback endpoint hit');
        return { message: 'Zoom callback endpoint is reachable', timestamp: new Date().toISOString() };
    }
    async zoomCallback(code, state, error, res, req) {
        console.log('[ZOOM DEBUG] Callback received at:', new Date().toISOString());
        console.log('[ZOOM DEBUG] Callback URL:', req.url);
        console.log('[ZOOM DEBUG] Callback query params:', { code, state, error });
        console.log('[ZOOM DEBUG] Callback headers:', req.headers);
        console.log('[ZOOM DEBUG] Callback user agent:', req.get('User-Agent'));
        console.log('[ZOOM DEBUG] Callback referer:', req.get('Referer'));
        console.log('[ZOOM DEBUG] Callback method:', req.method);
        console.log('[ZOOM DEBUG] Callback IP:', req.ip);
        if (error) {
            console.error('[ZOOM DEBUG] OAuth error:', error);
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            console.log('[ZOOM DEBUG] Redirecting back with zoom_error:', error, 'to', `${baseUrl}/dashboard?zoom_error=${encodeURIComponent(error)}`);
            return res.redirect(`${baseUrl}/dashboard?zoom_error=${encodeURIComponent(error)}`);
        }
        if (!code) {
            console.error('[ZOOM DEBUG] No authorization code received');
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            console.log('[ZOOM DEBUG] Redirecting back with zoom_error=no_code to', `${baseUrl}/dashboard?zoom_error=no_code`);
            return res.redirect(`${baseUrl}/dashboard?zoom_error=no_code`);
        }
        try {
            await this.integrationsService.handleZoomCallback(code, state);
            console.log('[ZOOM DEBUG] Callback handled successfully, redirecting to dashboard');
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            console.log('[ZOOM DEBUG] Redirecting to', `${baseUrl}/dashboard?zoom_success=true`);
            return res.redirect(`${baseUrl}/dashboard?zoom_success=true`);
        }
        catch (error) {
            console.error('[ZOOM DEBUG] Callback error:', error);
            console.error('[ZOOM DEBUG] Error stack:', error.stack);
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            console.log('[ZOOM DEBUG] Redirecting back with zoom_error:', error?.message, 'to', `${baseUrl}/dashboard?zoom_error=${encodeURIComponent(error.message)}`);
            return res.redirect(`${baseUrl}/dashboard?zoom_error=${encodeURIComponent(error.message)}`);
        }
    }
    async outlookCallback(req, res) {
        console.log('[OUTLOOK DEBUG] Callback received at:', new Date().toISOString());
        console.log('[OUTLOOK DEBUG] Callback URL:', req.url);
        console.log('[OUTLOOK DEBUG] Callback query params:', req.query);
        console.log('[OUTLOOK DEBUG] Callback headers:', req.headers);
        const { code, error, error_description, state } = req.query;
        if (error) {
            console.error('[OUTLOOK DEBUG] OAuth error:', error, error_description);
            console.error('[OUTLOOK DEBUG] Full error details:', { error, error_description, state });
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${baseUrl}/dashboard?outlook_error=${encodeURIComponent(error)}`);
        }
        if (!code) {
            console.error('[OUTLOOK DEBUG] No authorization code received');
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${baseUrl}/dashboard?outlook_error=no_code`);
        }
        try {
            await this.integrationsService.handleOutlookCallback(code, state);
            console.log('[OUTLOOK DEBUG] Callback handled successfully, redirecting to dashboard');
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${baseUrl}/dashboard?outlook_success=true`);
        }
        catch (error) {
            console.error('[OUTLOOK DEBUG] Callback error:', error);
            console.error('[OUTLOOK DEBUG] Error stack:', error.stack);
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${baseUrl}/dashboard?outlook_error=${encodeURIComponent(error.message)}`);
        }
    }
};
exports.IntegrationsController = IntegrationsController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('google/auth-url'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IntegrationsController.prototype, "googleAuthUrl", null);
__decorate([
    (0, common_1.Get)('google/callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "googleCallback", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('google/events'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('timeMin')),
    __param(2, (0, common_1.Query)('timeMax')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "googleEvents", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('google/status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "googleStatus", null);
__decorate([
    (0, common_1.Post)('google-meet'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IntegrationsController.prototype, "googleMeet", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('zoom/auth-url'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IntegrationsController.prototype, "zoomAuthUrl", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('outlook/auth-url'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IntegrationsController.prototype, "outlookAuthUrl", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('zoom/status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "zoomStatus", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('outlook/status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "outlookStatus", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)('zoom/disconnect'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "disconnectZoom", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)('outlook/disconnect'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "disconnectOutlook", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('apple/connect'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "connectApple", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('apple/status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "appleStatus", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)('apple/disconnect'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "disconnectApple", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('apple/calendars'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "appleCalendars", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('apple/select'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('selectedCalendars')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Array]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "selectApple", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)('google/disconnect'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "disconnectGoogle", null);
__decorate([
    (0, common_1.Get)('zoom/test-callback'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], IntegrationsController.prototype, "testZoomCallback", null);
__decorate([
    (0, common_1.Get)('zoom/callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Res)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "zoomCallback", null);
__decorate([
    (0, common_1.Get)('outlook/callback'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "outlookCallback", null);
exports.IntegrationsController = IntegrationsController = __decorate([
    (0, common_1.Controller)('integrations'),
    __metadata("design:paramtypes", [integrations_service_1.IntegrationsService])
], IntegrationsController);
//# sourceMappingURL=integrations.controller.js.map
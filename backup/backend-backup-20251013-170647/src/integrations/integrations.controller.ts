import { Body, Controller, Get, Post, Query, Req, UseGuards, Res, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('google/auth-url')
  googleAuthUrl(@Req() req) {
    const url = this.integrationsService.generateGoogleAuthUrl(req.user.userId);
    return { url };
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res) {
    await this.integrationsService.handleGoogleCallback(code, state);
    // Redirect back to the frontend dashboard after successful authentication
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${baseUrl}/dashboard`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('google/events')
  async googleEvents(@Req() req, @Query('timeMin') timeMin?: string, @Query('timeMax') timeMax?: string) {
    const events = await this.integrationsService.listGoogleEvents(req.user.userId, timeMin, timeMax);
    return { events };
  }

  @UseGuards(JwtAuthGuard)
  @Get('google/status')
  async googleStatus(@Req() req) {
    const connected = await this.integrationsService.isGoogleConnected(req.user.userId);
    return { connected };
  }

  @Post('google-meet')
  googleMeet(@Body() body: any) {
    return this.integrationsService.connectGoogleMeet(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('zoom/auth-url')
  zoomAuthUrl(@Req() req) {
    console.log('[ZOOM DEBUG] Auth URL requested by user:', req.user.userId);
    console.log('[ZOOM DEBUG] Request headers:', req.headers);
    const url = this.integrationsService.generateZoomAuthUrl(req.user.userId);
    console.log('[ZOOM DEBUG] Generated auth URL:', url);
    // Extra: surface redirect_uri and client_id for diagnostics
    try {
      const u = new URL(url);
      console.log('[ZOOM DEBUG] Auth URL params:', {
        client_id: u.searchParams.get('client_id'),
        redirect_uri: u.searchParams.get('redirect_uri'),
        has_code_challenge: !!u.searchParams.get('code_challenge'),
        code_challenge_method: u.searchParams.get('code_challenge_method'),
        prompt: u.searchParams.get('prompt'),
      });
    } catch {}
    return { url };
  }

  @UseGuards(JwtAuthGuard)
  @Get('outlook/auth-url')
  outlookAuthUrl(@Req() req) {
    const url = this.integrationsService.generateOutlookAuthUrl(req.user.userId);
    return { url };
  }


  @UseGuards(JwtAuthGuard)
  @Get('zoom/status')
  async zoomStatus(@Req() req) {
    const connected = await this.integrationsService.isZoomConnected(
      req.user.userId,
    );
    return { connected };
  }

  @UseGuards(JwtAuthGuard)
  @Get('outlook/status')
  async outlookStatus(@Req() req) {
    const connected = await this.integrationsService.isOutlookConnected(
      req.user.userId,
    );
    return { connected };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('zoom/disconnect')
  async disconnectZoom(@Req() req) {
    await this.integrationsService.disconnectZoom(req.user.userId);
    return { message: 'Zoom disconnected' };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('outlook/disconnect')
  async disconnectOutlook(@Req() req) {
    await this.integrationsService.disconnectOutlook(req.user.userId);
    return { message: 'Outlook disconnected' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('apple/connect')
  async connectApple(@Req() req, @Body() body: { email: string; password: string }) {
    await this.integrationsService.connectAppleCalendar(req.user.userId, body.email, body.password);
    return { message: 'Apple Calendar connected' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('apple/status')
  async appleStatus(@Req() req) {
    const connected = await this.integrationsService.isAppleConnected(req.user.userId);
    return { connected };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('apple/disconnect')
  async disconnectApple(@Req() req) {
    await this.integrationsService.disconnectAppleCalendar(req.user.userId);
    return { message: 'Apple Calendar disconnected' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('apple/calendars')
  async appleCalendars(@Req() req) {
    const calendars = await this.integrationsService.getAppleCalendars(
      req.user.userId,
    );
    return { calendars };
  }

  @UseGuards(JwtAuthGuard)
  @Post('apple/select')
  async selectApple(@Req() req, @Body('selectedCalendars') selectedCalendars: string[]) {
    await this.integrationsService.updateAppleCalendarSelection(req.user.userId, selectedCalendars);
    return { message: 'Apple calendars updated' };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('google/disconnect')
  async disconnectGoogle(@Req() req) {
    await this.integrationsService.disconnectGoogle(req.user.userId);
    return { message: 'Google Calendar disconnected' };
  }

  @Get('zoom/test-callback')
  testZoomCallback() {
    console.log('[ZOOM DEBUG] Test callback endpoint hit');
    return { message: 'Zoom callback endpoint is reachable', timestamp: new Date().toISOString() };
  }

  @Get('zoom/callback')
  async zoomCallback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res, @Req() req) {
    console.log('[ZOOM DEBUG] Callback received at:', new Date().toISOString());
    console.log('[ZOOM DEBUG] Callback URL:', req.url);
    console.log('[ZOOM DEBUG] Callback query params:', { code, state, error });
    console.log('[ZOOM DEBUG] Callback headers:', req.headers);
    console.log('[ZOOM DEBUG] Callback user agent:', req.get('User-Agent'));
    console.log('[ZOOM DEBUG] Callback referer:', req.get('Referer'));
    console.log('[ZOOM DEBUG] Callback method:', req.method);
    console.log('[ZOOM DEBUG] Callback IP:', req.ip);
    
    // Handle OAuth errors
    if (error) {
      console.error('[ZOOM DEBUG] OAuth error:', error);
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      console.log('[ZOOM DEBUG] Redirecting back with zoom_error:', error, 'to', `${baseUrl}/dashboard?zoom_error=${encodeURIComponent(error)}`);
      return res.redirect(`${baseUrl}/dashboard?zoom_error=${encodeURIComponent(error)}`);
    }
    
    // Handle missing authorization code
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
    } catch (error) {
      console.error('[ZOOM DEBUG] Callback error:', error);
      console.error('[ZOOM DEBUG] Error stack:', error.stack);
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      console.log('[ZOOM DEBUG] Redirecting back with zoom_error:', error?.message, 'to', `${baseUrl}/dashboard?zoom_error=${encodeURIComponent(error.message)}`);
      return res.redirect(`${baseUrl}/dashboard?zoom_error=${encodeURIComponent(error.message)}`);
    }
  }

  @Get('outlook/callback')
  async outlookCallback(@Req() req, @Res() res) {
    console.log('[OUTLOOK DEBUG] Callback received at:', new Date().toISOString());
    console.log('[OUTLOOK DEBUG] Callback URL:', req.url);
    console.log('[OUTLOOK DEBUG] Callback query params:', req.query);
    console.log('[OUTLOOK DEBUG] Callback headers:', req.headers);
    
    const { code, error, error_description, state } = req.query as any;

    if (error) {
      console.error('[OUTLOOK DEBUG] OAuth error:', error, error_description);
      console.error('[OUTLOOK DEBUG] Full error details:', { error, error_description, state });
      
      // Redirect to dashboard with error message instead of returning 400
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
    } catch (error) {
      console.error('[OUTLOOK DEBUG] Callback error:', error);
      console.error('[OUTLOOK DEBUG] Error stack:', error.stack);
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${baseUrl}/dashboard?outlook_error=${encodeURIComponent(error.message)}`);
    }
  }
}

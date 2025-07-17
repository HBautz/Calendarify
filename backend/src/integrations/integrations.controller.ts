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
  @Post('zoom')
  async connectZoom(@Req() req) {
    await this.integrationsService.connectZoom(req.user.userId);
    return { message: 'Zoom connected' };
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
  @Delete('zoom/disconnect')
  async disconnectZoom(@Req() req) {
    await this.integrationsService.disconnectZoom(req.user.userId);
    return { message: 'Zoom disconnected' };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('google/disconnect')
  async disconnectGoogle(@Req() req) {
    await this.integrationsService.disconnectGoogle(req.user.userId);
    return { message: 'Google Calendar disconnected' };
  }
}

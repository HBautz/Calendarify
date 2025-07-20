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
    const url = this.integrationsService.generateZoomAuthUrl(req.user.userId);
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
  @Delete('zoom/disconnect')
  async disconnectZoom(@Req() req) {
    await this.integrationsService.disconnectZoom(req.user.userId);
    return { message: 'Zoom disconnected' };
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
  @Delete('google/disconnect')
  async disconnectGoogle(@Req() req) {
    await this.integrationsService.disconnectGoogle(req.user.userId);
    return { message: 'Google Calendar disconnected' };
  }

  @Get('zoom/callback')
  async zoomCallback(@Query('code') code: string, @Query('state') state: string, @Res() res) {
    await this.integrationsService.handleZoomCallback(code, state);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${baseUrl}/dashboard`);
  }
}

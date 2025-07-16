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
    // Redirect back to the dashboard once authentication succeeds
    return res.redirect('/dashboard');
  }

  @UseGuards(JwtAuthGuard)
  @Get('google/events')
  async googleEvents(@Req() req, @Query('timeMin') timeMin?: string, @Query('timeMax') timeMax?: string) {
    const events = await this.integrationsService.listGoogleEvents(req.user.userId, timeMin, timeMax);
    return { events };
  }

  @Post('google-meet')
  googleMeet(@Body() body: any) {
    return this.integrationsService.connectGoogleMeet(body);
  }

  @Post('zoom')
  zoom(@Body() body: any) {
    return this.integrationsService.connectZoom(body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('google/disconnect')
  async disconnectGoogle(@Req() req) {
    await this.integrationsService.disconnectGoogle(req.user.userId);
    return { message: 'Google Calendar disconnected' };
  }
}

import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private integrations: IntegrationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('zoom/activate')
  zoom(@Request() req) {
    return this.integrations.activate(req.user.userId, 'zoom');
  }

  @UseGuards(JwtAuthGuard)
  @Post('google-meet/activate')
  google(@Request() req) {
    return this.integrations.activate(req.user.userId, 'google-meet');
  }
}

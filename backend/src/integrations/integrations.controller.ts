import { Body, Controller, Post } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('google')
  google(@Body() body: any) {
    return { message: 'google integration stub', data: body };
  }

  @Post('google-meet')
  googleMeet(@Body() body: any) {
    return this.integrationsService.connectGoogleMeet(body);
  }

  @Post('zoom')
  zoom(@Body() body: any) {
    return this.integrationsService.connectZoom(body);
  }
}

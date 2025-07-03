import { Body, Controller, Post } from '@nestjs/common';

@Controller('integrations')
export class IntegrationsController {
  @Post('google')
  google(@Body() body: any) {
    return { message: 'google integration stub', data: body };
  }
}

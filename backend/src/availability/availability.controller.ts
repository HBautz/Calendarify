import { Body, Controller, Patch } from '@nestjs/common';

@Controller('availability')
export class AvailabilityController {
  @Patch()
  update(@Body() body: any) {
    return { message: 'availability update stub', data: body };
  }
}

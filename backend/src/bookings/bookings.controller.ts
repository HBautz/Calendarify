import { Controller, Delete, Param } from '@nestjs/common';

@Controller('bookings')
export class BookingsController {
  @Delete(':id')
  remove(@Param('id') id: string) {
    return { id };
  }
}

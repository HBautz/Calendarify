import { Controller, Delete, Param, Get, UseGuards, Request, Patch, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Request() req) {
    return this.bookings.findForUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookings.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.bookings.update(id, body);
  }
}

import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma.service';
import { EventTypesService } from '../event-types/event-types.service';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, PrismaService, EventTypesService],
  exports: [BookingsService],
})
export class BookingsModule {}

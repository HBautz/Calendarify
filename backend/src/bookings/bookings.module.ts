import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma.service';
import { AvailabilityModule } from '../availability/availability.module';
import { EventTypesModule } from '../event-types/event-types.module';

@Module({
  imports: [AvailabilityModule, EventTypesModule],
  controllers: [BookingsController],
  providers: [BookingsService, PrismaService],
  exports: [BookingsService],
})
export class BookingsModule {}

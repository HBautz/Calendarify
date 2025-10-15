import { Module } from '@nestjs/common';
import { EventTypesController } from './event-types.controller';
import { EventTypesService } from './event-types.service';
import { AvailabilityModule } from '../availability/availability.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [AvailabilityModule],
  controllers: [EventTypesController],
  providers: [EventTypesService, PrismaService],
  exports: [EventTypesService],
})
export class EventTypesModule {}

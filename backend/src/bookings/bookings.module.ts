import { Module, forwardRef } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma.service';
import { AvailabilityModule } from '../availability/availability.module';
import { EventTypesModule } from '../event-types/event-types.module';
// import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [AvailabilityModule, forwardRef(() => EventTypesModule)],
  controllers: [BookingsController],
  providers: [BookingsService, PrismaService],
  exports: [BookingsService],
})
export class BookingsModule {}

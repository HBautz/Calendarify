import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, PrismaService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}

import { Module } from '@nestjs/common';
import { EventTypesController } from './event-types.controller';
import { EventTypesService } from './event-types.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EventTypesController],
  providers: [EventTypesService, PrismaService],
})
export class EventTypesModule {}

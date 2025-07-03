import { Module } from '@nestjs/common';
import { EventTypesController } from './event-types.controller';

@Module({
  controllers: [EventTypesController],
})
export class EventTypesModule {}

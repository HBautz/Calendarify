import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { UserStateService } from '../users/user-state.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, UserStateService, PrismaService],
})
export class IntegrationsModule {}

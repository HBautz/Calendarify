import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowExecutionService } from './workflow-execution.service';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowExecutionService, PrismaService, NotificationsService],
  exports: [WorkflowExecutionService],
})
export class WorkflowsModule {}

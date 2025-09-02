import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowExecutionService } from './workflow-execution.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowExecutionService, PrismaService],
  exports: [WorkflowExecutionService],
})
export class WorkflowsModule {}

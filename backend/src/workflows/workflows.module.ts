import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowsService, PrismaService],
})
export class WorkflowsModule {}

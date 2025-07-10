import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  data?: any;
}

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const workflows = await this.prisma.workflow.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' },
    });
    return workflows.map(w => ({
      id: w.id,
      userId: w.user_id,
      name: w.name,
      description: w.description || undefined,
      data: w.data || undefined,
    }));
  }

  async create(userId: string, data: Pick<Workflow, 'name' | 'description' | 'data'>) {
    const workflow = await this.prisma.workflow.create({
      data: {
        user_id: userId,
        name: data.name,
        description: data.description,
        data: data.data,
      },
    });
    return {
      id: workflow.id,
      userId: workflow.user_id,
      name: workflow.name,
      description: workflow.description || undefined,
      data: workflow.data || undefined,
    };
  }

  async remove(userId: string, workflowId: string) {
    await this.prisma.workflow.deleteMany({
      where: { id: workflowId, user_id: userId },
    });
  }

  async update(userId: string, workflowId: string, data: Partial<Workflow>) {
    await this.prisma.workflow.updateMany({
      where: { id: workflowId, user_id: userId },
      data: {
        name: data.name,
        description: data.description,
        data: data.data,
      },
    });
    return this.prisma.workflow.findUnique({ where: { id: workflowId } });
  }
}

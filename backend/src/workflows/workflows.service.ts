import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  data?: any;
  /**
   * ISO string of last update time used for displaying in the UI
   */
  lastEdited?: string;
  /**
   * Flattened properties from the data JSON for convenience
   */
  trigger?: string;
  triggerEventTypes?: string[];
  steps?: any[];
  status?: boolean;
}

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  private format(raw: any): Workflow {
    const data = raw.data || {};
    return {
      id: raw.id,
      userId: raw.user_id,
      name: raw.name,
      description: raw.description || undefined,
      lastEdited: raw.updated_at ? new Date(raw.updated_at).toISOString() : undefined,
      trigger: data.trigger,
      triggerEventTypes: data.triggerEventTypes,
      steps: data.steps,
      status: typeof data.status === 'boolean' ? data.status : undefined,
      data,
    };
  }

  async list(userId: string) {
    const workflows = await this.prisma.workflow.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' },
    });
    return workflows.map(w => this.format(w));
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
    return this.format(workflow);
  }

  async findById(userId: string, workflowId: string): Promise<Workflow | null> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, user_id: userId },
    });
    if (!workflow) return null;
    return this.format(workflow);
  }

  async findById(userId: string, workflowId: string): Promise<Workflow | null> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, user_id: userId },
    });
    if (!workflow) return null;
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
    const updated = await this.prisma.workflow.updateMany({
      where: { id: workflowId, user_id: userId },
      data: {
        name: data.name,
        description: data.description,
        data: data.data,
      },
    });
    if (updated.count === 0) return null;
    const wf = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    return wf ? this.format(wf) : null;
  }
}

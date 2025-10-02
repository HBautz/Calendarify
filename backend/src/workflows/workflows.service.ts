import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

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
  triggerTags?: string[];
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
      triggerTags: data.triggerTags,
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

  // ----- Drafts API -----
  async listDraftBranches(userId: string, workflowId: string) {
    const drafts = await this.prisma.workflowDraft.findMany({
      where: { user_id: userId, workflow_id: workflowId },
      orderBy: { updated_at: 'desc' },
      select: { id: true, branch: true, version: true, name: true, updated_at: true },
    });
    const latestByBranch = new Map<string, any>();
    for (const d of drafts) {
      if (!latestByBranch.has(d.branch)) latestByBranch.set(d.branch, d);
    }
    return Array.from(latestByBranch.values());
  }

  async listDrafts(userId: string, workflowId: string, branch?: string) {
    return this.prisma.workflowDraft.findMany({
      where: { user_id: userId, workflow_id: workflowId, ...(branch ? { branch } : {}) },
      orderBy: [{ branch: 'asc' }, { updated_at: 'desc' }],
      select: { id: true, branch: true, version: true, name: true, data: true, created_at: true, updated_at: true },
    });
  }

  async createDraft(userId: string, workflowId: string, body: { branch?: string; name?: string; data: any }) {
    const branch = body.branch && body.branch.trim() ? body.branch.trim() : 'draft';
    const created = await this.prisma.workflowDraft.create({
      data: {
        user_id: userId,
        workflow_id: workflowId,
        branch,
        name: body.name || null,
        data: body.data,
      },
    });
    return created;
  }

  async applyDraft(userId: string, workflowId: string, draftId: string) {
    const draft = await this.prisma.workflowDraft.findFirst({
      where: { id: draftId, user_id: userId, workflow_id: workflowId },
    });
    if (!draft) return null;
    await this.prisma.workflow.updateMany({
      where: { id: workflowId, user_id: userId },
      data: { data: draft.data as unknown as Prisma.InputJsonValue },
    });
    const wf = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    return wf ? this.format(wf) : null;
  }

  async deleteDraftBranch(userId: string, workflowId: string, branch: string) {
    if (!branch || branch === 'main') return { deleted: 0 };
    const res = await this.prisma.workflowDraft.deleteMany({
      where: { user_id: userId, workflow_id: workflowId, branch },
    });
    return { deleted: res.count };
  }

  async renameDraft(userId: string, workflowId: string, draftId: string, name: string) {
    // Debug log before
    try { console.log('[DRAFT][SVC] rename', { userId, workflowId, draftId, name }); } catch {}
    const updated = await this.prisma.workflowDraft.updateMany({
      where: { id: draftId, user_id: userId, workflow_id: workflowId },
      data: { name },
    });
    try { console.log('[DRAFT][SVC] rename result', { count: updated.count }); } catch {}
    return { updated: updated.count };
  }
}

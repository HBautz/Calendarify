"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let WorkflowsService = class WorkflowsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    format(raw) {
        const source = raw.data || {};
        const data = (() => {
            try {
                const cloned = typeof source === 'object' ? JSON.parse(JSON.stringify(source)) : {};
                if (!cloned.triggerDomId)
                    cloned.triggerDomId = 'node-1';
                if (Array.isArray(cloned.steps)) {
                    cloned.steps = cloned.steps.map((step, idx) => {
                        const s = step && typeof step === 'object' ? step : {};
                        if (!s.id && !s.domId) {
                            s.id = `node-${idx + 2}`;
                        }
                        return s;
                    });
                }
                return cloned;
            }
            catch {
                return source || {};
            }
        })();
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
    async list(userId) {
        const workflows = await this.prisma.workflow.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'asc' },
        });
        return workflows.map(w => this.format(w));
    }
    async create(userId, data) {
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
    async findById(userId, workflowId) {
        const workflow = await this.prisma.workflow.findFirst({
            where: { id: workflowId, user_id: userId },
        });
        if (!workflow)
            return null;
        return this.format(workflow);
    }
    async remove(userId, workflowId) {
        await this.prisma.workflow.deleteMany({
            where: { id: workflowId, user_id: userId },
        });
    }
    async update(userId, workflowId, data) {
        const updated = await this.prisma.workflow.updateMany({
            where: { id: workflowId, user_id: userId },
            data: {
                name: data.name,
                description: data.description,
                data: data.data,
            },
        });
        if (updated.count === 0)
            return null;
        const wf = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
        return wf ? this.format(wf) : null;
    }
    async listDraftBranches(userId, workflowId) {
        const drafts = await this.prisma.workflowDraft.findMany({
            where: { user_id: userId, workflow_id: workflowId },
            orderBy: { updated_at: 'desc' },
            select: { id: true, branch: true, version: true, name: true, updated_at: true },
        });
        const latestByBranch = new Map();
        for (const d of drafts) {
            if (!latestByBranch.has(d.branch))
                latestByBranch.set(d.branch, d);
        }
        return Array.from(latestByBranch.values());
    }
    async listDrafts(userId, workflowId, branch) {
        return this.prisma.workflowDraft.findMany({
            where: { user_id: userId, workflow_id: workflowId, ...(branch ? { branch } : {}) },
            orderBy: [{ branch: 'asc' }, { updated_at: 'desc' }],
            select: { id: true, branch: true, version: true, name: true, data: true, created_at: true, updated_at: true },
        });
    }
    async createDraft(userId, workflowId, body) {
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
    async applyDraft(userId, workflowId, draftId) {
        const draft = await this.prisma.workflowDraft.findFirst({
            where: { id: draftId, user_id: userId, workflow_id: workflowId },
        });
        if (!draft)
            return null;
        await this.prisma.workflow.updateMany({
            where: { id: workflowId, user_id: userId },
            data: { data: draft.data },
        });
        const wf = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
        return wf ? this.format(wf) : null;
    }
    async deleteDraftBranch(userId, workflowId, branch) {
        if (!branch || branch === 'main')
            return { deleted: 0 };
        const res = await this.prisma.workflowDraft.deleteMany({
            where: { user_id: userId, workflow_id: workflowId, branch },
        });
        return { deleted: res.count };
    }
    async renameDraft(userId, workflowId, draftId, name) {
        try {
            console.log('[DRAFT][SVC] rename', { userId, workflowId, draftId, name });
        }
        catch { }
        const updated = await this.prisma.workflowDraft.updateMany({
            where: { id: draftId, user_id: userId, workflow_id: workflowId },
            data: { name },
        });
        try {
            console.log('[DRAFT][SVC] rename result', { count: updated.count });
        }
        catch { }
        return { updated: updated.count };
    }
};
exports.WorkflowsService = WorkflowsService;
exports.WorkflowsService = WorkflowsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorkflowsService);
//# sourceMappingURL=workflows.service.js.map
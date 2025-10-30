import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
export interface Workflow {
    id: string;
    userId: string;
    name: string;
    description?: string;
    data?: any;
    lastEdited?: string;
    trigger?: string;
    triggerEventTypes?: string[];
    triggerTags?: string[];
    steps?: any[];
    status?: boolean;
}
export declare class WorkflowsService {
    private prisma;
    constructor(prisma: PrismaService);
    private format;
    list(userId: string): Promise<Workflow[]>;
    create(userId: string, data: Pick<Workflow, 'name' | 'description' | 'data'>): Promise<Workflow>;
    findById(userId: string, workflowId: string): Promise<Workflow | null>;
    remove(userId: string, workflowId: string): Promise<void>;
    update(userId: string, workflowId: string, data: Partial<Workflow>): Promise<Workflow | null>;
    listDraftBranches(userId: string, workflowId: string): Promise<any[]>;
    listDrafts(userId: string, workflowId: string, branch?: string): Promise<{
        id: string;
        name: string | null;
        data: Prisma.JsonValue;
        created_at: Date;
        updated_at: Date;
        branch: string;
        version: number;
    }[]>;
    createDraft(userId: string, workflowId: string, body: {
        branch?: string;
        name?: string;
        data: any;
    }): Promise<{
        id: string;
        user_id: string;
        name: string | null;
        data: Prisma.JsonValue;
        created_at: Date;
        updated_at: Date;
        workflow_id: string;
        branch: string;
        version: number;
    }>;
    applyDraft(userId: string, workflowId: string, draftId: string): Promise<Workflow | null>;
    deleteDraftBranch(userId: string, workflowId: string, branch: string): Promise<{
        deleted: number;
    }>;
    renameDraft(userId: string, workflowId: string, draftId: string, name: string): Promise<{
        updated: number;
    }>;
}

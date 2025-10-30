import { WorkflowsService } from './workflows.service';
import { WorkflowExecutionService } from './workflow-execution.service';
export declare class WorkflowsController {
    private workflows;
    private execution;
    constructor(workflows: WorkflowsService, execution: WorkflowExecutionService);
    list(req: any): Promise<import("./workflows.service").Workflow[]>;
    findOne(req: any, id: string): Promise<import("./workflows.service").Workflow | null>;
    create(req: any, body: {
        name: string;
        description?: string;
        data?: any;
    }): Promise<import("./workflows.service").Workflow>;
    remove(req: any, id: string): Promise<void>;
    update(req: any, id: string, body: any): Promise<import("./workflows.service").Workflow | null>;
    listDrafts(req: any, id: string, branch?: string): Promise<{
        id: string;
        name: string | null;
        data: import("@prisma/client/runtime/library").JsonValue;
        created_at: Date;
        updated_at: Date;
        branch: string;
        version: number;
    }[]>;
    listDraftBranches(req: any, id: string): Promise<any[]>;
    createDraft(req: any, id: string, body: {
        branch?: string;
        name?: string;
        data: any;
    }): Promise<{
        id: string;
        user_id: string;
        name: string | null;
        data: import("@prisma/client/runtime/library").JsonValue;
        created_at: Date;
        updated_at: Date;
        workflow_id: string;
        branch: string;
        version: number;
    }>;
    applyDraft(req: any, id: string, draftId: string): Promise<import("./workflows.service").Workflow | null>;
    deleteDraftBranch(req: any, id: string, branch: string): Promise<{
        deleted: number;
    }>;
    renameDraft(req: any, id: string, draftId: string, body: {
        name: string;
    }): Promise<{
        updated: number;
    }>;
    errorsForWorkflow(req: any, id: string, limit?: string): Promise<{
        ts: number;
        userId: string;
        workflowId: string;
        workflowName: string;
        stepIndex: number;
        stepType: string;
        message: string;
        stack?: string;
    }[]>;
    runsForWorkflow(req: any, id: string, limit?: string): Promise<any[]> | never[];
    runDetails(req: any, id: string, runId: string): Promise<any> | null;
}

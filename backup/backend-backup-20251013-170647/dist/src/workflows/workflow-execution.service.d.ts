import { PrismaService } from '../prisma.service';
import { WorkflowsService } from './workflows.service';
import { NotificationsService } from '../notifications/notifications.service';
export interface WorkflowExecutionContext {
    userId: string;
    eventType?: string;
    tagName?: string;
    bookingId?: string;
    contactId?: string;
    [key: string]: any;
}
export declare class WorkflowExecutionService {
    private prisma;
    private workflowsService;
    private notifications;
    private readonly logger;
    private static errorLog;
    private static readonly MAX_ERRORS;
    private static runLog;
    constructor(prisma: PrismaService, workflowsService: WorkflowsService, notifications: NotificationsService);
    onMeetingScheduled(userId: string, eventTypeTitle: string, bookingId: string, eventTypeId?: string): Promise<void>;
    onTagAdded(userId: string, tagName: string, contactId: string): Promise<void>;
    private executeWorkflow;
    private executeStep;
    private executeIf;
    evaluateIfForTest(props: any, context: WorkflowExecutionContext): Promise<{
        result: boolean;
        detail: string;
        actual: any;
    }>;
    private attachContextPayload;
    private resolveFieldValue;
    private coerceEquals;
    private coerceContains;
    private coerceCompare;
    private executeSendEmail;
    private executeDelay;
    private executeAddTag;
    static addError(entry: {
        ts: number;
        userId: string;
        workflowId: string;
        workflowName: string;
        stepIndex: number;
        stepType: string;
        message: string;
        stack?: string;
    }): void;
    getErrorsFor(userId: string, workflowId?: string, limit?: number): Promise<{
        ts: number;
        userId: string;
        workflowId: string;
        workflowName: string;
        stepIndex: number;
        stepType: string;
        message: string;
        stack?: string;
    }[]>;
    getRuns(userId: string, workflowId: string, limit?: number): Promise<any[]>;
    getRunDetails(userId: string, workflowId: string, runId: string): Promise<any>;
}

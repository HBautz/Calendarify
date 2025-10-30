import { PrismaService } from '../prisma.service';
import { WorkflowExecutionService } from '../workflows/workflow-execution.service';
export interface Contact {
    id: string;
    userId: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    notes?: string;
    favorite: boolean;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
export declare class ContactsService {
    private prisma;
    private workflowExecutionService;
    constructor(prisma: PrismaService, workflowExecutionService: WorkflowExecutionService);
    list(userId: string): Promise<Contact[]>;
    create(userId: string, data: {
        name: string;
        email: string;
        phone?: string;
        company?: string;
        notes?: string;
        favorite?: boolean;
        tags?: string[];
    }): Promise<Contact>;
    addTagToContact(contactId: string, userId: string, tagName: string): Promise<void>;
    removeTagFromContact(contactId: string, userId: string, tagName: string): Promise<void>;
    update(contactId: string, userId: string, data: Partial<Contact>): Promise<Contact>;
    findById(contactId: string, userId: string): Promise<Contact | null>;
    delete(contactId: string, userId: string): Promise<void>;
}

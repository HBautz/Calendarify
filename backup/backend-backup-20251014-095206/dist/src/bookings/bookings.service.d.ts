import { PrismaService } from '../prisma.service';
import { EventTypesService } from '../event-types/event-types.service';
import { AvailabilityService } from '../availability/availability.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { WorkflowExecutionService } from '../workflows/workflow-execution.service';
interface CreateBookingDto {
    event_type_id: string;
    user_id: string;
    name: string;
    email: string;
    starts_at: Date;
    ends_at: Date;
}
interface CreatePublicBookingDto {
    event_type_slug: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    starts_at: string;
    ends_at: string;
    questions?: any[];
    client_timezone?: string;
    client_offset_minutes?: number;
}
export declare class BookingsService {
    private prisma;
    private eventTypesService;
    private availabilityService;
    private integrationsService;
    private workflowExecutionService;
    constructor(prisma: PrismaService, eventTypesService: EventTypesService, availabilityService: AvailabilityService, integrationsService: IntegrationsService, workflowExecutionService: WorkflowExecutionService);
    findOneForUser(userId: string, id: string): Promise<({
        event_type: {
            id: string;
            user_id: string;
            description: string | null;
            created_at: Date;
            updated_at: Date;
            slug: string;
            title: string;
            duration: number;
            buffer_before: number;
            buffer_after: number;
            advance_notice: number;
            slot_interval: number;
            questions: import("@prisma/client/runtime/library").JsonValue | null;
            required_fields: import("@prisma/client/runtime/library").JsonValue | null;
            confirmation_message: string | null;
        };
        notes: {
            id: string;
            created_at: Date;
            booking_id: string;
            note: string;
        }[];
    } & {
        id: string;
        user_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        event_type_id: string;
        email: string;
        starts_at: Date;
        ends_at: Date;
        zoom_link: string | null;
        google_meet_link: string | null;
    }) | null>;
    create(data: CreateBookingDto): Promise<{
        event_type: {
            id: string;
            user_id: string;
            description: string | null;
            created_at: Date;
            updated_at: Date;
            slug: string;
            title: string;
            duration: number;
            buffer_before: number;
            buffer_after: number;
            advance_notice: number;
            slot_interval: number;
            questions: import("@prisma/client/runtime/library").JsonValue | null;
            required_fields: import("@prisma/client/runtime/library").JsonValue | null;
            confirmation_message: string | null;
        };
    } & {
        id: string;
        user_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        event_type_id: string;
        email: string;
        starts_at: Date;
        ends_at: Date;
        zoom_link: string | null;
        google_meet_link: string | null;
    }>;
    createPublic(data: CreatePublicBookingDto): Promise<{
        event_type: {
            id: string;
            user_id: string;
            description: string | null;
            created_at: Date;
            updated_at: Date;
            slug: string;
            title: string;
            duration: number;
            buffer_before: number;
            buffer_after: number;
            advance_notice: number;
            slot_interval: number;
            questions: import("@prisma/client/runtime/library").JsonValue | null;
            required_fields: import("@prisma/client/runtime/library").JsonValue | null;
            confirmation_message: string | null;
        };
        notes: {
            id: string;
            created_at: Date;
            booking_id: string;
            note: string;
        }[];
    } & {
        id: string;
        user_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        event_type_id: string;
        email: string;
        starts_at: Date;
        ends_at: Date;
        zoom_link: string | null;
        google_meet_link: string | null;
    }>;
    private createCalendarEvents;
    private createEventInCalendar;
    private createGoogleCalendarEvent;
    private createZoomMeeting;
    private createOutlookCalendarEvent;
    private createAppleCalendarEvent;
    private getApplePrincipalUrl;
    private getAppleCalendarHomeUrl;
    private getAppleTargetCalendarUrl;
    private createICSEvent;
    findForUser(userId: string): import(".prisma/client").Prisma.PrismaPromise<({
        event_type: {
            id: string;
            user_id: string;
            description: string | null;
            created_at: Date;
            updated_at: Date;
            slug: string;
            title: string;
            duration: number;
            buffer_before: number;
            buffer_after: number;
            advance_notice: number;
            slot_interval: number;
            questions: import("@prisma/client/runtime/library").JsonValue | null;
            required_fields: import("@prisma/client/runtime/library").JsonValue | null;
            confirmation_message: string | null;
        };
        notes: {
            id: string;
            created_at: Date;
            booking_id: string;
            note: string;
        }[];
    } & {
        id: string;
        user_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        event_type_id: string;
        email: string;
        starts_at: Date;
        ends_at: Date;
        zoom_link: string | null;
        google_meet_link: string | null;
    })[]>;
    remove(id: string): Promise<{
        id: string;
        user_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        event_type_id: string;
        email: string;
        starts_at: Date;
        ends_at: Date;
        zoom_link: string | null;
        google_meet_link: string | null;
    }>;
    private deleteCalendarEvents;
    update(id: string, data: {
        start: string;
        end: string;
    }): Promise<{
        event_type: {
            id: string;
            user_id: string;
            description: string | null;
            created_at: Date;
            updated_at: Date;
            slug: string;
            title: string;
            duration: number;
            buffer_before: number;
            buffer_after: number;
            advance_notice: number;
            slot_interval: number;
            questions: import("@prisma/client/runtime/library").JsonValue | null;
            required_fields: import("@prisma/client/runtime/library").JsonValue | null;
            confirmation_message: string | null;
        };
    } & {
        id: string;
        user_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        event_type_id: string;
        email: string;
        starts_at: Date;
        ends_at: Date;
        zoom_link: string | null;
        google_meet_link: string | null;
    }>;
    private updateCalendarEvents;
    private updateEventInCalendar;
}
export {};

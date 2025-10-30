import { BookingsService } from './bookings.service';
export declare class BookingsController {
    private bookings;
    constructor(bookings: BookingsService);
    list(req: any): import(".prisma/client").Prisma.PrismaPromise<({
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
    findOne(req: any, id: string): Promise<({
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
    create(body: any): Promise<{
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
    update(id: string, body: any): Promise<{
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
}

import { PrismaService } from '../prisma.service';
import { AvailabilityService } from '../availability/availability.service';
export interface EventType {
    id: string;
    userId: string;
    userDisplayName?: string;
    slug: string;
    title: string;
    description?: string;
    duration: number;
    bufferBefore: number;
    bufferAfter: number;
    advanceNotice: number;
    slotInterval: number;
    questions?: any[];
    requiredFields?: any;
    confirmationMessage?: string;
    bookingLimit?: any;
}
export interface CreateEventTypeData {
    title: string;
    slug?: string;
    description?: string;
    duration: number;
    bufferBefore?: number;
    bufferAfter?: number;
    advanceNotice?: number;
    slotInterval?: number;
    questions?: any[];
    requiredFields?: any;
    confirmationMessage?: string;
    bookingLimit?: any;
}
export declare class EventTypesService {
    private prisma;
    private availabilityService;
    constructor(prisma: PrismaService, availabilityService: AvailabilityService);
    list(userId: string): Promise<EventType[]>;
    create(userId: string, data: CreateEventTypeData): Promise<EventType>;
    findOne(id: string): Promise<EventType | null>;
    findBySlug(slug: string): Promise<EventType | null>;
    update(id: string, data: Partial<CreateEventTypeData>, userId?: string): Promise<EventType>;
    remove(id: string): Promise<void>;
    getAvailableSlots(slug: string, date: Date, excludeBookingId?: string): Promise<string[]>;
    createBooking(slug: string, data: {
        name: string;
        email: string;
        start: string;
        end: string;
        questions?: any[];
        excludeBookingId?: string;
    }): Promise<any>;
    private mapToEventType;
}

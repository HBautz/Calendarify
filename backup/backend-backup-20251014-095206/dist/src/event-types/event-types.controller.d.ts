import { EventTypesService } from './event-types.service';
export declare class EventTypesController {
    private eventTypesService;
    constructor(eventTypesService: EventTypesService);
    list(req: any): Promise<import("./event-types.service").EventType[]>;
    create(req: any, data: any): Promise<import("./event-types.service").EventType>;
    findBySlug(slug: string): Promise<import("./event-types.service").EventType>;
    findOne(id: string): Promise<import("./event-types.service").EventType>;
    update(req: any, id: string, data: any): Promise<import("./event-types.service").EventType>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
    getAvailableSlots(slug: string, dateStr: string, excludeBookingId?: string): Promise<string[] | import("./event-types.service").EventType>;
    createBooking(slug: string, data: any): Promise<any>;
}

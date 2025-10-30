import { PrismaService } from '../prisma.service';
export interface AvailabilityRule {
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
}
export interface AvailabilityOverride {
    date: Date;
    startMinute?: number;
    endMinute?: number;
    isBusy: boolean;
}
export interface TimeSlot {
    start: Date;
    end: Date;
    isAvailable: boolean;
}
export declare class AvailabilityService {
    private prisma;
    constructor(prisma: PrismaService);
    getAvailabilityRules(userId: string): Promise<AvailabilityRule[]>;
    getAvailabilityOverrides(userId: string, startDate: Date, endDate: Date): Promise<AvailabilityOverride[]>;
    upsertAvailabilityOverride(userId: string, date: Date, isAvailable: boolean, startUtcMinute?: number, endUtcMinute?: number): Promise<void>;
    deleteAvailabilityOverride(userId: string, date: Date): Promise<void>;
    getExistingBookings(userId: string, startDate: Date, endDate: Date, excludeBookingId?: string): Promise<{
        start: Date;
        end: Date;
    }[]>;
    isSlotAvailable(userId: string, startTime: Date, endTime: Date, excludeBookingId?: string, bufferBefore?: number, bufferAfter?: number): Promise<boolean>;
    generateAvailableSlots(userId: string, date: Date, duration: number, bufferBefore?: number, bufferAfter?: number, advanceNotice?: number, slotInterval?: number, excludeBookingId?: string): Promise<TimeSlot[]>;
    private checkSlotAvailability;
    updateAvailabilityRules(userId: string, rules: AvailabilityRule[]): Promise<void>;
}

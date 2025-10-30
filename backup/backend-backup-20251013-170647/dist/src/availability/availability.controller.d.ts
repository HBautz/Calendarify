import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma.service';
export declare class AvailabilityController {
    private availabilityService;
    private prisma;
    constructor(availabilityService: AvailabilityService, prisma: PrismaService);
    getRules(req: any): Promise<import("./availability.service").AvailabilityRule[]>;
    getRulesByDisplayName(displayName: string): Promise<import("./availability.service").AvailabilityRule[]>;
    getOverrides(req: any, startDate: string, endDate: string): Promise<import("./availability.service").AvailabilityOverride[]>;
    updateRules(req: any, body: {
        rules: any[];
    }): Promise<{
        success: boolean;
    }>;
    upsertOverride(req: any, body: {
        date: string;
        available: boolean;
        start?: string;
        end?: string;
    }): Promise<{
        success: boolean;
    }>;
    deleteOverride(req: any, dateStr: string): Promise<{
        success: boolean;
    }>;
}

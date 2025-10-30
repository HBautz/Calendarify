import { PrismaService } from '../prisma.service';
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    getDatabaseStatus(): Promise<{
        users: number;
        eventTypes: number;
        bookings: number;
        availabilityRules: number;
    }>;
    wipeDatabase(): Promise<{
        success: boolean;
        message: string;
        timestamp: string;
    }>;
}

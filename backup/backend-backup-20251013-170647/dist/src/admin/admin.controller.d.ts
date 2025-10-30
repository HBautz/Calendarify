import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getStatus(): Promise<{
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

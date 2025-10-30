import { PrismaService } from '../prisma.service';
export declare class TestingService {
    private prisma;
    constructor(prisma: PrismaService);
    getAvailability(userId: string): Promise<{
        user_id: string;
        total_rules: number;
        rules: {
            day: string;
            day_of_week: number;
            start_time: string;
            end_time: string;
            start_minutes: number;
            end_minutes: number;
            utc_start: string;
            utc_end: string;
        }[];
        raw_data: {
            id: string;
            user_id: string;
            day_of_week: number;
            start_minute: number;
            end_minute: number;
        }[];
    }>;
    updateAvailability(userId: string, body: any): Promise<{
        error: string;
        example: {
            day: string;
            start_time: string;
            end_time: string;
        };
        success?: undefined;
        message?: undefined;
        rule?: undefined;
    } | {
        error: string;
        example?: undefined;
        success?: undefined;
        message?: undefined;
        rule?: undefined;
    } | {
        success: boolean;
        message: string;
        rule: {
            day: string;
            start_time: string;
            end_time: string;
            start_minutes: number;
            end_minutes: number;
        };
        error?: undefined;
        example?: undefined;
    }>;
    getUserState(userId: string): Promise<{
        error: string;
        user_id?: undefined;
        email?: undefined;
        display_name?: undefined;
        availability_rules?: undefined;
        user_state?: undefined;
    } | {
        user_id: string;
        email: string;
        display_name: string | null;
        availability_rules: {
            id: string;
            user_id: string;
            day_of_week: number;
            start_minute: number;
            end_minute: number;
        }[];
        user_state: {
            user_id: string;
            data: import("@prisma/client/runtime/library").JsonValue | null;
        } | null;
        error?: undefined;
    }>;
    updateUserState(userId: string, body: any): Promise<{
        error: string;
        example: {
            key: string;
            value: {
                monday: {
                    start: string;
                    end: string;
                };
            };
        };
        success?: undefined;
        message?: undefined;
        data?: undefined;
    } | {
        success: boolean;
        message: string;
        data: import("@prisma/client/runtime/library").JsonValue;
        error?: undefined;
        example?: undefined;
    }>;
    testTimezone(body: any): Promise<{
        error: string;
        example: {
            local_time: string;
            timezone_offset: number;
        };
        input?: undefined;
        conversion?: undefined;
        timezone_info?: undefined;
    } | {
        input: {
            local_time: any;
            timezone_offset: any;
        };
        conversion: {
            utc_time: string;
            utc_minutes: number;
            converted_back_to_local: string;
        };
        timezone_info: {
            offset_minutes: any;
            offset_hours: number;
        };
        error?: undefined;
        example?: undefined;
    }>;
    getDebugInfo(userId: string): Promise<{
        error: string;
        user_info?: undefined;
        availability_rules?: undefined;
        user_state?: undefined;
        database_info?: undefined;
    } | {
        user_info: {
            id: string;
            email: string;
            display_name: string | null;
        };
        availability_rules: {
            count: number;
            rules: {
                day: string;
                start_time: string;
                end_time: string;
                start_minutes: number;
                end_minutes: number;
            }[];
        };
        user_state: string | number | true | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray;
        database_info: {
            total_rules: number;
            has_user_state: boolean;
        };
        error?: undefined;
    }>;
    private timeToMinutes;
    private minutesToTime;
}

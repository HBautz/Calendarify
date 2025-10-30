import { UsersService } from './users.service';
import { UserStateService } from './user-state.service';
export declare class UsersController {
    private users;
    private state;
    constructor(users: UsersService, state: UserStateService);
    me(req: any): import(".prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        name: string | null;
        created_at: Date;
        updated_at: Date;
        email: string;
        display_name: string | null;
        password: string;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    update(req: any, body: any): Promise<{
        id: string;
        name: string | null;
        created_at: Date;
        updated_at: Date;
        email: string;
        display_name: string | null;
        password: string;
    }>;
    byDisplayName(name: string): import(".prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        name: string | null;
        created_at: Date;
        updated_at: Date;
        email: string;
        display_name: string | null;
        password: string;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    stateByDisplay(name: string): Promise<any>;
    getState(req: any): Promise<any>;
    saveState(req: any, body: any): Promise<void>;
}

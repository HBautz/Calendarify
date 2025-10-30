import { PrismaService } from '../prisma.service';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findById(id: string): import(".prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        name: string | null;
        created_at: Date;
        updated_at: Date;
        email: string;
        display_name: string | null;
        password: string;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByDisplayName(displayName: string): import(".prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        name: string | null;
        created_at: Date;
        updated_at: Date;
        email: string;
        display_name: string | null;
        password: string;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, data: any): Promise<{
        id: string;
        name: string | null;
        created_at: Date;
        updated_at: Date;
        email: string;
        display_name: string | null;
        password: string;
    }>;
}

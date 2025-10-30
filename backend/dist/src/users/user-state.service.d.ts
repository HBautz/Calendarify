import { PrismaService } from '../prisma.service';
export declare class UserStateService {
    private prisma;
    constructor(prisma: PrismaService);
    private convertUTCMinutesToUTCTimeString;
    load(userId: string): Promise<any>;
    save(userId: string, data: any): Promise<void>;
    loadByDisplayName(displayName: string): Promise<any>;
}

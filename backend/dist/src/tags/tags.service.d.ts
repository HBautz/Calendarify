import { PrismaService } from '../prisma.service';
export interface Tag {
    id: string;
    userId: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class TagsService {
    private prisma;
    constructor(prisma: PrismaService);
    list(userId: string): Promise<Tag[]>;
    create(userId: string, name: string): Promise<Tag>;
    delete(userId: string, tagId: string): Promise<void>;
    findByName(userId: string, name: string): Promise<Tag | null>;
}

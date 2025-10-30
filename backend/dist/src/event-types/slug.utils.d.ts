export declare function slugify(text: string): string;
export declare function generateUniqueSlug(prisma: {
    eventType: {
        findUnique: (args: any) => Promise<any>;
    };
}, text: string, excludeId?: string): Promise<string>;
export declare function generateUniqueUserSlug(prisma: {
    user: {
        findUnique: (args: any) => Promise<any>;
    };
}, text: string, excludeId?: string): Promise<string>;

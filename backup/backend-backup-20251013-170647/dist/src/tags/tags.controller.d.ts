import { TagsService } from './tags.service';
export declare class TagsController {
    private tags;
    constructor(tags: TagsService);
    list(req: any): Promise<import("./tags.service").Tag[]>;
    create(req: any, body: {
        name: string;
    }): Promise<import("./tags.service").Tag>;
    delete(req: any, id: string): Promise<void>;
}

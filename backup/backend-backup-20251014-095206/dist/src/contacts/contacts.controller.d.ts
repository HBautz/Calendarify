import { ContactsService } from './contacts.service';
export declare class ContactsController {
    private contacts;
    constructor(contacts: ContactsService);
    list(req: any): Promise<import("./contacts.service").Contact[]>;
    create(req: any, body: {
        name: string;
        email: string;
        phone?: string;
        company?: string;
        notes?: string;
        favorite?: boolean;
        tags?: string[];
    }): Promise<import("./contacts.service").Contact>;
    findOne(req: any, id: string): Promise<import("./contacts.service").Contact | null>;
    update(req: any, id: string, body: any): Promise<import("./contacts.service").Contact>;
    delete(req: any, id: string): Promise<void>;
    addTag(req: any, id: string, body: {
        tagName: string;
    }): Promise<void>;
    removeTag(req: any, id: string, tagName: string): Promise<void>;
}

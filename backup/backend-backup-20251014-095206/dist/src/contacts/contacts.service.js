"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const workflow_execution_service_1 = require("../workflows/workflow-execution.service");
let ContactsService = class ContactsService {
    prisma;
    workflowExecutionService;
    constructor(prisma, workflowExecutionService) {
        this.prisma = prisma;
        this.workflowExecutionService = workflowExecutionService;
    }
    async list(userId) {
        const contacts = await this.prisma.contact.findMany({
            where: { user_id: userId },
            include: {
                tags: {
                    include: {
                        tag: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        return contacts.map(contact => {
            console.log('[CONTACTS DEBUG] Raw contact:', contact);
            console.log('[CONTACTS DEBUG] Contact tags:', contact.tags);
            const mappedContact = {
                id: contact.id,
                userId: contact.user_id,
                name: contact.name,
                email: contact.email,
                phone: contact.phone || undefined,
                company: contact.company || undefined,
                notes: contact.notes || undefined,
                favorite: contact.favorite,
                tags: contact.tags.map(ct => ct.tag.name),
                createdAt: contact.created_at,
                updatedAt: contact.updated_at
            };
            console.log('[CONTACTS DEBUG] Mapped contact:', mappedContact);
            return mappedContact;
        });
    }
    async create(userId, data) {
        const { tags, ...contactData } = data;
        const contact = await this.prisma.contact.create({
            data: {
                user_id: userId,
                ...contactData,
                favorite: contactData.favorite || false
            },
            include: {
                tags: {
                    include: {
                        tag: true
                    }
                }
            }
        });
        if (tags && tags.length > 0) {
            for (const tagName of tags) {
                await this.addTagToContact(contact.id, userId, tagName);
            }
        }
        return {
            id: contact.id,
            userId: contact.user_id,
            name: contact.name,
            email: contact.email,
            phone: contact.phone || undefined,
            company: contact.company || undefined,
            notes: contact.notes || undefined,
            favorite: contact.favorite,
            tags: contact.tags.map(ct => ct.tag.name),
            createdAt: contact.created_at,
            updatedAt: contact.updated_at
        };
    }
    async addTagToContact(contactId, userId, tagName) {
        let tag = await this.prisma.tag.findFirst({
            where: {
                user_id: userId,
                name: tagName.trim()
            }
        });
        if (!tag) {
            tag = await this.prisma.tag.create({
                data: {
                    user_id: userId,
                    name: tagName.trim()
                }
            });
        }
        const existingRelation = await this.prisma.contactTag.findFirst({
            where: {
                contact_id: contactId,
                tag_id: tag.id
            }
        });
        if (!existingRelation) {
            await this.prisma.contactTag.create({
                data: {
                    contact_id: contactId,
                    tag_id: tag.id
                }
            });
            try {
                await this.workflowExecutionService.onTagAdded(userId, tagName, contactId);
            }
            catch (error) {
                console.warn('[CONTACTS] Failed to trigger workflows:', error);
            }
        }
    }
    async removeTagFromContact(contactId, userId, tagName) {
        const tag = await this.prisma.tag.findFirst({
            where: {
                user_id: userId,
                name: tagName.trim()
            }
        });
        if (tag) {
            await this.prisma.contactTag.deleteMany({
                where: {
                    contact_id: contactId,
                    tag_id: tag.id
                }
            });
        }
    }
    async update(contactId, userId, data) {
        const { tags, ...updateData } = data;
        await this.prisma.contact.updateMany({
            where: {
                id: contactId,
                user_id: userId
            },
            data: updateData
        });
        if (tags !== undefined) {
            await this.prisma.contactTag.deleteMany({
                where: {
                    contact_id: contactId
                }
            });
            if (tags && tags.length > 0) {
                for (const tagName of tags) {
                    await this.addTagToContact(contactId, userId, tagName);
                }
            }
        }
        const updated = await this.findById(contactId, userId);
        if (!updated)
            throw new Error('Contact not found after update');
        return updated;
    }
    async findById(contactId, userId) {
        const contact = await this.prisma.contact.findFirst({
            where: {
                id: contactId,
                user_id: userId
            },
            include: {
                tags: {
                    include: {
                        tag: true
                    }
                }
            }
        });
        if (!contact)
            return null;
        return {
            id: contact.id,
            userId: contact.user_id,
            name: contact.name,
            email: contact.email,
            phone: contact.phone || undefined,
            company: contact.company || undefined,
            notes: contact.notes || undefined,
            favorite: contact.favorite,
            tags: contact.tags.map(ct => ct.tag.name),
            createdAt: contact.created_at,
            updatedAt: contact.updated_at
        };
    }
    async delete(contactId, userId) {
        await this.prisma.contact.deleteMany({
            where: {
                id: contactId,
                user_id: userId
            }
        });
    }
};
exports.ContactsService = ContactsService;
exports.ContactsService = ContactsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        workflow_execution_service_1.WorkflowExecutionService])
], ContactsService);
//# sourceMappingURL=contacts.service.js.map
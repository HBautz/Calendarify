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
exports.TagsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let TagsService = class TagsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(userId) {
        const tags = await this.prisma.tag.findMany({
            where: { user_id: userId },
            orderBy: { name: 'asc' }
        });
        return tags.map(tag => ({
            id: tag.id,
            userId: tag.user_id,
            name: tag.name,
            createdAt: tag.created_at,
            updatedAt: tag.updated_at
        }));
    }
    async create(userId, name) {
        const tag = await this.prisma.tag.create({
            data: {
                user_id: userId,
                name: name.trim()
            }
        });
        return {
            id: tag.id,
            userId: tag.user_id,
            name: tag.name,
            createdAt: tag.created_at,
            updatedAt: tag.updated_at
        };
    }
    async delete(userId, tagId) {
        await this.prisma.tag.deleteMany({
            where: {
                id: tagId,
                user_id: userId
            }
        });
    }
    async findByName(userId, name) {
        const tag = await this.prisma.tag.findFirst({
            where: {
                user_id: userId,
                name: name.trim()
            }
        });
        if (!tag)
            return null;
        return {
            id: tag.id,
            userId: tag.user_id,
            name: tag.name,
            createdAt: tag.created_at,
            updatedAt: tag.updated_at
        };
    }
};
exports.TagsService = TagsService;
exports.TagsService = TagsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TagsService);
//# sourceMappingURL=tags.service.js.map
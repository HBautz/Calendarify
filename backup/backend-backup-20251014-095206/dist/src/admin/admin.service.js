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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let AdminService = class AdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDatabaseStatus() {
        const [users, eventTypes, bookings, availabilityRules] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.eventType.count(),
            this.prisma.booking.count(),
            this.prisma.availabilityRule.count(),
        ]);
        return {
            users,
            eventTypes,
            bookings,
            availabilityRules,
        };
    }
    async wipeDatabase() {
        try {
            await this.prisma.bookingNote.deleteMany();
            await this.prisma.booking.deleteMany();
            await this.prisma.contactTag.deleteMany();
            await this.prisma.contact.deleteMany();
            await this.prisma.tag.deleteMany();
            await this.prisma.availabilityOverride.deleteMany();
            await this.prisma.availabilityRule.deleteMany();
            await this.prisma.userState.deleteMany();
            await this.prisma.workflow.deleteMany();
            await this.prisma.externalCalendar.deleteMany();
            await this.prisma.eventType.deleteMany();
            await this.prisma.user.deleteMany();
            return {
                success: true,
                message: 'Database wiped successfully',
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            throw new Error(`Failed to wipe database: ${error.message}`);
        }
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map
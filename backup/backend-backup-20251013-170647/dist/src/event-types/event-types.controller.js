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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventTypesController = void 0;
const common_1 = require("@nestjs/common");
const event_types_service_1 = require("./event-types.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let EventTypesController = class EventTypesController {
    eventTypesService;
    constructor(eventTypesService) {
        this.eventTypesService = eventTypesService;
    }
    async list(req) {
        try {
            return await this.eventTypesService.list(req.user.userId);
        }
        catch (error) {
            throw new common_1.HttpException('Failed to list event types', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async create(req, data) {
        try {
            return await this.eventTypesService.create(req.user.userId, data);
        }
        catch (error) {
            throw new common_1.HttpException('Failed to create event type', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async findBySlug(slug) {
        try {
            const eventType = await this.eventTypesService.findBySlug(slug);
            if (!eventType) {
                throw new common_1.HttpException('Event type not found', common_1.HttpStatus.NOT_FOUND);
            }
            return eventType;
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException('Failed to find event type', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async findOne(id) {
        try {
            const eventType = await this.eventTypesService.findOne(id);
            if (!eventType) {
                throw new common_1.HttpException('Event type not found', common_1.HttpStatus.NOT_FOUND);
            }
            return eventType;
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException('Failed to find event type', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async update(req, id, data) {
        try {
            return await this.eventTypesService.update(id, data, req.user.userId);
        }
        catch (error) {
            if (error.message?.includes('not found')) {
                throw new common_1.HttpException('Event type not found', common_1.HttpStatus.NOT_FOUND);
            }
            throw new common_1.HttpException('Failed to update event type', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async remove(id) {
        try {
            await this.eventTypesService.remove(id);
            return { success: true };
        }
        catch (error) {
            throw new common_1.HttpException('Failed to delete event type', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAvailableSlots(slug, dateStr, excludeBookingId) {
        try {
            if (!dateStr) {
                const eventType = await this.eventTypesService.findBySlug(slug);
                if (!eventType) {
                    throw new common_1.HttpException('Event type not found', common_1.HttpStatus.NOT_FOUND);
                }
                return eventType;
            }
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                throw new common_1.HttpException('Invalid date format', common_1.HttpStatus.BAD_REQUEST);
            }
            return await this.eventTypesService.getAvailableSlots(slug, date, excludeBookingId);
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            if (error.message?.includes('not found')) {
                throw new common_1.HttpException('Event type not found', common_1.HttpStatus.NOT_FOUND);
            }
            throw new common_1.HttpException('Failed to get available slots', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createBooking(slug, data) {
        try {
            if (!data.name || !data.email || !data.start || !data.end) {
                throw new common_1.HttpException('Missing required booking fields', common_1.HttpStatus.BAD_REQUEST);
            }
            const bookingData = {
                name: data.name,
                email: data.email,
                start: data.start,
                end: data.end,
                questions: data.questions,
                excludeBookingId: data.excludeBookingId
            };
            return await this.eventTypesService.createBooking(slug, bookingData);
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            if (error.message?.includes('not found')) {
                throw new common_1.HttpException('Event type not found', common_1.HttpStatus.NOT_FOUND);
            }
            if (error.message?.includes('not available')) {
                throw new common_1.HttpException('Selected time slot is not available', common_1.HttpStatus.CONFLICT);
            }
            throw new common_1.HttpException('Failed to create booking', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.EventTypesController = EventTypesController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EventTypesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], EventTypesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('slug/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EventTypesController.prototype, "findBySlug", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EventTypesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], EventTypesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EventTypesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':slug/slots'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('date')),
    __param(2, (0, common_1.Query)('exclude')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], EventTypesController.prototype, "getAvailableSlots", null);
__decorate([
    (0, common_1.Post)(':slug/book'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EventTypesController.prototype, "createBooking", null);
exports.EventTypesController = EventTypesController = __decorate([
    (0, common_1.Controller)('event-types'),
    __metadata("design:paramtypes", [event_types_service_1.EventTypesService])
], EventTypesController);
//# sourceMappingURL=event-types.controller.js.map
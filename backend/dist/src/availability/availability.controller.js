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
exports.AvailabilityController = void 0;
const common_1 = require("@nestjs/common");
const availability_service_1 = require("./availability.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../prisma.service");
let AvailabilityController = class AvailabilityController {
    availabilityService;
    prisma;
    constructor(availabilityService, prisma) {
        this.availabilityService = availabilityService;
        this.prisma = prisma;
    }
    async getRules(req) {
        try {
            return await this.availabilityService.getAvailabilityRules(req.user.userId);
        }
        catch (error) {
            throw new common_1.HttpException('Failed to get availability rules', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getRulesByDisplayName(displayName) {
        try {
            const user = await this.prisma.user.findFirst({
                where: { display_name: displayName }
            });
            if (!user) {
                throw new common_1.HttpException('User not found', common_1.HttpStatus.NOT_FOUND);
            }
            return await this.availabilityService.getAvailabilityRules(user.id);
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException('Failed to get availability rules', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getOverrides(req, startDate, endDate) {
        try {
            console.log('[OVERRIDE DEBUG] GET /overrides called:', {
                userId: req.user.userId,
                startDate,
                endDate
            });
            if (!startDate || !endDate) {
                throw new common_1.HttpException('start and end dates are required', common_1.HttpStatus.BAD_REQUEST);
            }
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new common_1.HttpException('Invalid date format', common_1.HttpStatus.BAD_REQUEST);
            }
            console.log('[OVERRIDE DEBUG] Parsed dates:', {
                start: start.toISOString(),
                end: end.toISOString()
            });
            const overrides = await this.availabilityService.getAvailabilityOverrides(req.user.userId, start, end);
            console.log('[OVERRIDE DEBUG] Returning overrides:', overrides);
            return overrides;
        }
        catch (error) {
            console.log('[OVERRIDE DEBUG] Error fetching overrides:', error);
            if (error instanceof common_1.HttpException)
                throw error;
            throw new common_1.HttpException('Failed to get overrides', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateRules(req, body) {
        try {
            if (!body.rules || !Array.isArray(body.rules)) {
                throw new common_1.HttpException('Rules array is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const validRules = body.rules.map((rule, index) => {
                const dayOfWeek = parseInt(rule.day_of_week);
                const startMinute = parseInt(rule.start_minute);
                const endMinute = parseInt(rule.end_minute);
                if (isNaN(dayOfWeek) || isNaN(startMinute) || isNaN(endMinute)) {
                    throw new common_1.HttpException(`Invalid numeric values in rule at index ${index}`, common_1.HttpStatus.BAD_REQUEST);
                }
                if (dayOfWeek < 0 || dayOfWeek > 6) {
                    throw new common_1.HttpException(`Invalid day of week (${dayOfWeek}) in rule at index ${index}. Must be 0-6.`, common_1.HttpStatus.BAD_REQUEST);
                }
                if (startMinute < 0 || startMinute >= 1440) {
                    throw new common_1.HttpException(`Invalid start minute (${startMinute}) in rule at index ${index}. Must be 0-1439.`, common_1.HttpStatus.BAD_REQUEST);
                }
                if (endMinute < 0 || endMinute >= 1440) {
                    throw new common_1.HttpException(`Invalid end minute (${endMinute}) in rule at index ${index}. Must be 0-1439.`, common_1.HttpStatus.BAD_REQUEST);
                }
                if (startMinute >= endMinute) {
                    throw new common_1.HttpException(`Start minute (${startMinute}) must be less than end minute (${endMinute}) in rule at index ${index}.`, common_1.HttpStatus.BAD_REQUEST);
                }
                return {
                    dayOfWeek,
                    startMinute,
                    endMinute
                };
            });
            await this.availabilityService.updateAvailabilityRules(req.user.userId, validRules);
            return { success: true };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException('Failed to update availability rules', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async upsertOverride(req, body) {
        try {
            console.log('[OVERRIDE DEBUG] POST /overrides called:', {
                userId: req.user.userId,
                body
            });
            if (!body?.date || typeof body.available !== 'boolean') {
                throw new common_1.HttpException('date and available are required', common_1.HttpStatus.BAD_REQUEST);
            }
            const [year, month, day] = body.date.split('-').map(n => parseInt(n));
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                throw new common_1.HttpException('Invalid date format', common_1.HttpStatus.BAD_REQUEST);
            }
            const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
            if (isNaN(date.getTime())) {
                throw new common_1.HttpException('Invalid date', common_1.HttpStatus.BAD_REQUEST);
            }
            console.log('[OVERRIDE DEBUG] Parsed date:', {
                inputDate: body.date,
                parsedDate: date.toISOString()
            });
            let startUtcMinute = undefined;
            let endUtcMinute = undefined;
            const toUtcMinutes = (hhmm) => {
                const [h, m] = hhmm.split(':').map(n => parseInt(n));
                if (isNaN(h) || isNaN(m))
                    return undefined;
                const [year, month, day] = body.date.split('-').map(n => parseInt(n));
                const localDateTime = new Date(year, month - 1, day, h, m, 0, 0);
                const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
                const utcMinutes = Math.floor((localDateTime.getTime() - utcMidnight.getTime()) / 60000);
                return utcMinutes;
            };
            if (body.start)
                startUtcMinute = toUtcMinutes(body.start);
            if (body.end)
                endUtcMinute = toUtcMinutes(body.end);
            console.log('[OVERRIDE DEBUG] Time conversion:', {
                start: body.start,
                end: body.end,
                startUtcMinute,
                endUtcMinute,
                date: date.toISOString(),
                localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            });
            await this.availabilityService.upsertAvailabilityOverride(req.user.userId, date, body.available, startUtcMinute, endUtcMinute);
            console.log('[OVERRIDE DEBUG] Override saved successfully');
            return { success: true };
        }
        catch (error) {
            console.log('[OVERRIDE DEBUG] Error saving override:', error);
            if (error instanceof common_1.HttpException)
                throw error;
            throw new common_1.HttpException('Failed to upsert override', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async deleteOverride(req, dateStr) {
        try {
            console.log('[OVERRIDE DEBUG] DELETE /overrides/:date called:', {
                userId: req.user.userId,
                dateStr
            });
            const [year, month, day] = dateStr.split('-').map(n => parseInt(n));
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                throw new common_1.HttpException('Invalid date format', common_1.HttpStatus.BAD_REQUEST);
            }
            const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
            if (isNaN(date.getTime())) {
                throw new common_1.HttpException('Invalid date', common_1.HttpStatus.BAD_REQUEST);
            }
            console.log('[OVERRIDE DEBUG] Parsed date for deletion:', {
                inputDate: dateStr,
                parsedDate: date.toISOString()
            });
            await this.availabilityService.deleteAvailabilityOverride(req.user.userId, date);
            console.log('[OVERRIDE DEBUG] Override deleted successfully');
            return { success: true };
        }
        catch (error) {
            console.log('[OVERRIDE DEBUG] Error deleting override:', error);
            if (error instanceof common_1.HttpException)
                throw error;
            throw new common_1.HttpException('Failed to delete override', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.AvailabilityController = AvailabilityController;
__decorate([
    (0, common_1.Get)('rules'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AvailabilityController.prototype, "getRules", null);
__decorate([
    (0, common_1.Get)('rules/:displayName'),
    __param(0, (0, common_1.Param)('displayName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AvailabilityController.prototype, "getRulesByDisplayName", null);
__decorate([
    (0, common_1.Get)('overrides'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('start')),
    __param(2, (0, common_1.Query)('end')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AvailabilityController.prototype, "getOverrides", null);
__decorate([
    (0, common_1.Patch)('rules'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AvailabilityController.prototype, "updateRules", null);
__decorate([
    (0, common_1.Post)('overrides'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AvailabilityController.prototype, "upsertOverride", null);
__decorate([
    (0, common_1.Delete)('overrides/:date'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AvailabilityController.prototype, "deleteOverride", null);
exports.AvailabilityController = AvailabilityController = __decorate([
    (0, common_1.Controller)('availability'),
    __metadata("design:paramtypes", [availability_service_1.AvailabilityService,
        prisma_service_1.PrismaService])
], AvailabilityController);
//# sourceMappingURL=availability.controller.js.map
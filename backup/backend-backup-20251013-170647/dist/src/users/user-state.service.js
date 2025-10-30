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
exports.UserStateService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let UserStateService = class UserStateService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    convertUTCMinutesToUTCTimeString(utcMinutes) {
        const utcHours = Math.floor(utcMinutes / 60);
        const utcMins = utcMinutes % 60;
        return `${utcHours.toString().padStart(2, '0')}:${utcMins.toString().padStart(2, '0')}`;
    }
    async load(userId) {
        const state = await this.prisma.userState.findUnique({
            where: { user_id: userId },
        });
        let data = state?.data || {};
        if (!data['calendarify-weekly-hours']) {
            data['calendarify-weekly-hours'] = {};
        }
        const availabilityRules = await this.prisma.availabilityRule.findMany({
            where: { user_id: userId },
        });
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayAvailability = {};
        dayNames.forEach(day => {
            dayAvailability[day] = false;
        });
        if (availabilityRules.length > 0) {
            availabilityRules.forEach(rule => {
                const dayName = dayNames[rule.day_of_week];
                dayAvailability[dayName] = true;
            });
        }
        data['calendarify-day-availability'] = dayAvailability;
        if (availabilityRules.length > 0) {
            const weeklyHours = {};
            availabilityRules.forEach(rule => {
                const dayName = dayNames[rule.day_of_week];
                const utcStart = this.convertUTCMinutesToUTCTimeString(rule.start_minute);
                const utcEnd = this.convertUTCMinutesToUTCTimeString(rule.end_minute);
                weeklyHours[dayName] = {
                    start: utcStart,
                    end: utcEnd
                };
            });
            data['calendarify-weekly-hours'] = weeklyHours;
        }
        return data;
    }
    async save(userId, data) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            console.log(`User with id ${userId} not found, skipping user state save`);
            return;
        }
        await this.prisma.userState.upsert({
            where: { user_id: userId },
            update: { data },
            create: { user_id: userId, data },
        });
    }
    async loadByDisplayName(displayName) {
        const user = await this.prisma.user.findUnique({ where: { display_name: displayName } });
        if (!user)
            return {};
        const state = await this.prisma.userState.findUnique({
            where: { user_id: user.id },
        });
        let data = state?.data || {};
        if (!data['calendarify-weekly-hours']) {
            data['calendarify-weekly-hours'] = {};
        }
        const availabilityRules = await this.prisma.availabilityRule.findMany({
            where: { user_id: user.id },
        });
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayAvailability = {};
        dayNames.forEach(day => {
            dayAvailability[day] = false;
        });
        if (availabilityRules.length > 0) {
            availabilityRules.forEach(rule => {
                const dayName = dayNames[rule.day_of_week];
                dayAvailability[dayName] = true;
            });
        }
        data['calendarify-day-availability'] = dayAvailability;
        if (availabilityRules.length > 0) {
            const weeklyHours = {};
            availabilityRules.forEach(rule => {
                const dayName = dayNames[rule.day_of_week];
                const utcStart = this.convertUTCMinutesToUTCTimeString(rule.start_minute);
                const utcEnd = this.convertUTCMinutesToUTCTimeString(rule.end_minute);
                weeklyHours[dayName] = {
                    start: utcStart,
                    end: utcEnd
                };
            });
            data['calendarify-weekly-hours'] = weeklyHours;
        }
        return data;
    }
};
exports.UserStateService = UserStateService;
exports.UserStateService = UserStateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserStateService);
//# sourceMappingURL=user-state.service.js.map
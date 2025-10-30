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
exports.TestingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let TestingService = class TestingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAvailability(userId) {
        const rules = await this.prisma.availabilityRule.findMany({
            where: { user_id: userId },
            orderBy: { day_of_week: 'asc' }
        });
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const formattedRules = rules.map(rule => {
            const dayName = dayNames[rule.day_of_week];
            const startHours = Math.floor(rule.start_minute / 60);
            const startMinutes = rule.start_minute % 60;
            const endHours = Math.floor(rule.end_minute / 60);
            const endMinutes = rule.end_minute % 60;
            const startTime = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
            const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
            return {
                day: dayName,
                day_of_week: rule.day_of_week,
                start_time: startTime,
                end_time: endTime,
                start_minutes: rule.start_minute,
                end_minutes: rule.end_minute,
                utc_start: `${startTime} UTC`,
                utc_end: `${endTime} UTC`
            };
        });
        return {
            user_id: userId,
            total_rules: rules.length,
            rules: formattedRules,
            raw_data: rules
        };
    }
    async updateAvailability(userId, body) {
        const { day, start_time, end_time } = body;
        if (!day || !start_time || !end_time) {
            return {
                error: 'Missing required fields: day, start_time, end_time',
                example: {
                    day: 'monday',
                    start_time: '09:00',
                    end_time: '17:00'
                }
            };
        }
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = dayNames.indexOf(day.toLowerCase());
        if (dayIndex === -1) {
            return {
                error: 'Invalid day. Must be one of: sunday, monday, tuesday, wednesday, thursday, friday, saturday'
            };
        }
        const startMinutes = this.timeToMinutes(start_time);
        const endMinutes = this.timeToMinutes(end_time);
        if (startMinutes === null || endMinutes === null) {
            return {
                error: 'Invalid time format. Use HH:MM format (e.g., 09:00, 17:30)'
            };
        }
        const rule = await this.prisma.availabilityRule.upsert({
            where: {
                id: `${userId}_${dayIndex}`
            },
            update: {
                start_minute: startMinutes,
                end_minute: endMinutes
            },
            create: {
                user_id: userId,
                day_of_week: dayIndex,
                start_minute: startMinutes,
                end_minute: endMinutes
            }
        });
        return {
            success: true,
            message: `Updated ${day} availability`,
            rule: {
                day: dayNames[dayIndex],
                start_time: this.minutesToTime(startMinutes),
                end_time: this.minutesToTime(endMinutes),
                start_minutes: startMinutes,
                end_minutes: endMinutes
            }
        };
    }
    async getUserState(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                availability_rules: true,
                user_state: true
            }
        });
        if (!user) {
            return { error: 'User not found' };
        }
        return {
            user_id: userId,
            email: user.email,
            display_name: user.display_name,
            availability_rules: user.availability_rules,
            user_state: user.user_state
        };
    }
    async updateUserState(userId, body) {
        const { key, value } = body;
        if (!key || value === undefined) {
            return {
                error: 'Missing required fields: key, value',
                example: {
                    key: 'calendarify-weekly-hours',
                    value: { monday: { start: '09:00', end: '17:00' } }
                }
            };
        }
        const existingUserState = await this.prisma.userState.findUnique({
            where: { user_id: userId }
        });
        const userState = await this.prisma.userState.upsert({
            where: { user_id: userId },
            update: {
                data: {
                    ...(existingUserState?.data || {}),
                    [key]: value
                }
            },
            create: {
                user_id: userId,
                data: { [key]: value }
            }
        });
        return {
            success: true,
            message: `Updated user state key: ${key}`,
            data: userState.data
        };
    }
    async testTimezone(body) {
        const { local_time, timezone_offset } = body;
        if (!local_time) {
            return {
                error: 'Missing local_time',
                example: {
                    local_time: '09:00',
                    timezone_offset: -120
                }
            };
        }
        const [hours, minutes] = local_time.split(':').map(Number);
        const offset = timezone_offset || 0;
        const utcMinutes = hours * 60 + minutes - offset;
        const utcHours = Math.floor(utcMinutes / 60);
        const utcMins = utcMinutes % 60;
        const utcTime = `${utcHours.toString().padStart(2, '0')}:${utcMins.toString().padStart(2, '0')}`;
        const localMinutes = utcMinutes + offset;
        const localHours = Math.floor(localMinutes / 60);
        const localMins = localMinutes % 60;
        const convertedLocalTime = `${localHours.toString().padStart(2, '0')}:${localMins.toString().padStart(2, '0')}`;
        return {
            input: {
                local_time,
                timezone_offset: offset
            },
            conversion: {
                utc_time: utcTime,
                utc_minutes: utcMinutes,
                converted_back_to_local: convertedLocalTime
            },
            timezone_info: {
                offset_minutes: offset,
                offset_hours: offset / 60
            }
        };
    }
    async getDebugInfo(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                availability_rules: {
                    orderBy: { day_of_week: 'asc' }
                },
                user_state: true
            }
        });
        if (!user) {
            return { error: 'User not found' };
        }
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availabilityInfo = user.availability_rules.map(rule => {
            const dayName = dayNames[rule.day_of_week];
            const startTime = this.minutesToTime(rule.start_minute);
            const endTime = this.minutesToTime(rule.end_minute);
            return {
                day: dayName,
                start_time: startTime,
                end_time: endTime,
                start_minutes: rule.start_minute,
                end_minutes: rule.end_minute
            };
        });
        return {
            user_info: {
                id: user.id,
                email: user.email,
                display_name: user.display_name
            },
            availability_rules: {
                count: user.availability_rules.length,
                rules: availabilityInfo
            },
            user_state: user.user_state?.data || {},
            database_info: {
                total_rules: user.availability_rules.length,
                has_user_state: !!user.user_state
            }
        };
    }
    timeToMinutes(timeStr) {
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!match)
            return null;
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null;
        }
        return hours * 60 + minutes;
    }
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
};
exports.TestingService = TestingService;
exports.TestingService = TestingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TestingService);
//# sourceMappingURL=testing.service.js.map
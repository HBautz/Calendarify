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
exports.AvailabilityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let AvailabilityService = class AvailabilityService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAvailabilityRules(userId) {
        const rules = await this.prisma.availabilityRule.findMany({
            where: { user_id: userId },
            orderBy: { day_of_week: 'asc' }
        });
        return rules.map(rule => ({
            dayOfWeek: rule.day_of_week,
            startMinute: rule.start_minute,
            endMinute: rule.end_minute
        }));
    }
    async getAvailabilityOverrides(userId, startDate, endDate) {
        console.log('[OVERRIDE DEBUG] getAvailabilityOverrides called:', {
            userId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });
        const allOverrides = await this.prisma.availabilityOverride.findMany({
            where: { user_id: userId }
        });
        console.log('[OVERRIDE DEBUG] All user overrides:', allOverrides.map(o => ({
            id: o.id,
            date: o.date.toISOString(),
            dateLocal: o.date.toLocaleDateString(),
            is_busy: o.is_busy,
            start_minute: o.start_minute,
            end_minute: o.end_minute
        })));
        const overrides = allOverrides.filter(override => {
            const overrideDate = override.date;
            return overrideDate >= startDate && overrideDate <= endDate;
        });
        console.log('[OVERRIDE DEBUG] Filtered overrides:', overrides.map(o => ({
            id: o.id,
            date: o.date.toISOString(),
            dateLocal: o.date.toLocaleDateString(),
            is_busy: o.is_busy,
            start_minute: o.start_minute,
            end_minute: o.end_minute
        })));
        return overrides.map(override => ({
            date: override.date,
            startMinute: override.start_minute || undefined,
            endMinute: override.end_minute || undefined,
            isBusy: override.is_busy
        }));
    }
    async upsertAvailabilityOverride(userId, date, isAvailable, startUtcMinute, endUtcMinute) {
        console.log('[OVERRIDE DEBUG] upsertAvailabilityOverride called:', {
            userId,
            inputDate: date.toISOString(),
            isAvailable,
            startUtcMinute,
            endUtcMinute
        });
        const dateUtc = date;
        const isBusy = !isAvailable;
        console.log('[OVERRIDE DEBUG] Normalized date:', {
            originalDate: date.toISOString(),
            normalizedDateUtc: dateUtc.toISOString(),
            isBusy
        });
        const targetDateString = dateUtc.toISOString().split('T')[0];
        const allUserOverrides = await this.prisma.availabilityOverride.findMany({
            where: { user_id: userId }
        });
        const existing = allUserOverrides.find(o => o.date.toISOString().split('T')[0] === targetDateString);
        console.log('[OVERRIDE DEBUG] Existing override found:', existing ? {
            id: existing.id,
            date: existing.date.toISOString(),
            is_busy: existing.is_busy,
            start_minute: existing.start_minute,
            end_minute: existing.end_minute
        } : 'none');
        if (existing) {
            console.log('[OVERRIDE DEBUG] Updating existing override');
            await this.prisma.availabilityOverride.update({
                where: { id: existing.id },
                data: {
                    is_busy: isBusy,
                    start_minute: startUtcMinute ?? null,
                    end_minute: endUtcMinute ?? null
                }
            });
            console.log('[OVERRIDE DEBUG] Override updated successfully');
        }
        else {
            console.log('[OVERRIDE DEBUG] Creating new override');
            await this.prisma.availabilityOverride.create({
                data: {
                    user_id: userId,
                    date: dateUtc,
                    is_busy: isBusy,
                    start_minute: startUtcMinute ?? null,
                    end_minute: endUtcMinute ?? null
                }
            });
            console.log('[OVERRIDE DEBUG] Override created successfully');
        }
    }
    async deleteAvailabilityOverride(userId, date) {
        console.log('[OVERRIDE DEBUG] deleteAvailabilityOverride called:', {
            userId,
            inputDate: date.toISOString()
        });
        const dateUtc = date;
        console.log('[OVERRIDE DEBUG] Normalized date for deletion:', {
            originalDate: date.toISOString(),
            normalizedDateUtc: dateUtc.toISOString()
        });
        const allOverrides = await this.prisma.availabilityOverride.findMany({
            where: { user_id: userId }
        });
        console.log('[OVERRIDE DEBUG] All overrides for user:', allOverrides.map(o => ({
            id: o.id,
            date: o.date.toISOString(),
            dateLocal: o.date.toLocaleDateString(),
            is_busy: o.is_busy
        })));
        console.log('[OVERRIDE DEBUG] Looking for override with date:', {
            dateUtc: dateUtc.toISOString(),
            dateUtcLocal: dateUtc.toLocaleDateString(),
            dateUtcTime: dateUtc.getTime()
        });
        const targetDateString = dateUtc.toISOString().split('T')[0];
        const allUserOverrides = await this.prisma.availabilityOverride.findMany({
            where: { user_id: userId }
        });
        console.log('[OVERRIDE DEBUG] All user overrides:', allUserOverrides.map(o => ({
            id: o.id,
            date: o.date.toISOString(),
            dateLocal: o.date.toLocaleDateString(),
            dateString: o.date.toISOString().split('T')[0],
            is_busy: o.is_busy
        })));
        const existing = allUserOverrides.find(o => o.date.toISOString().split('T')[0] === targetDateString);
        console.log('[OVERRIDE DEBUG] Target date string:', targetDateString);
        console.log('[OVERRIDE DEBUG] Existing override to delete:', existing ? {
            id: existing.id,
            date: existing.date.toISOString(),
            dateLocal: existing.date.toLocaleDateString(),
            is_busy: existing.is_busy
        } : 'none');
        if (existing) {
            const deleteResult = await this.prisma.availabilityOverride.delete({ where: { id: existing.id } });
            console.log('[OVERRIDE DEBUG] Override deleted successfully:', deleteResult);
            const verifyDelete = await this.prisma.availabilityOverride.findFirst({
                where: { user_id: userId, date: dateUtc }
            });
            console.log('[OVERRIDE DEBUG] Verification after delete:', verifyDelete ? 'STILL EXISTS' : 'SUCCESSFULLY DELETED');
        }
        else {
            console.log('[OVERRIDE DEBUG] No override found to delete');
        }
    }
    async getExistingBookings(userId, startDate, endDate, excludeBookingId) {
        const bookings = await this.prisma.booking.findMany({
            where: {
                user_id: userId,
                ...(excludeBookingId && { NOT: { id: excludeBookingId } }),
                AND: [
                    { starts_at: { lt: endDate } },
                    { ends_at: { gt: startDate } }
                ]
            },
            select: {
                starts_at: true,
                ends_at: true
            }
        });
        return bookings.map(booking => ({
            start: booking.starts_at,
            end: booking.ends_at
        }));
    }
    async isSlotAvailable(userId, startTime, endTime, excludeBookingId, bufferBefore = 0, bufferAfter = 0) {
        const dayOfWeek = startTime.getUTCDay();
        const startMinute = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
        const endMinute = endTime.getUTCHours() * 60 + endTime.getUTCMinutes();
        const rules = await this.getAvailabilityRules(userId);
        const dayRules = rules.filter(rule => rule.dayOfWeek === dayOfWeek);
        if (dayRules.length === 0) {
            return false;
        }
        const isWithinRules = dayRules.some(rule => startMinute >= rule.startMinute && endMinute <= rule.endMinute);
        if (!isWithinRules) {
            return false;
        }
        const dateStr = startTime.toISOString().split('T')[0];
        const overrides = await this.getAvailabilityOverrides(userId, new Date(dateStr), new Date(dateStr));
        const dayOverride = overrides.find(o => o.date.toISOString().split('T')[0] === dateStr);
        if (dayOverride) {
            if (dayOverride.isBusy) {
                return false;
            }
            if (dayOverride.startMinute !== undefined && startMinute < dayOverride.startMinute) {
                return false;
            }
            if (dayOverride.endMinute !== undefined && endMinute > dayOverride.endMinute) {
                return false;
            }
        }
        const overlapping = await this.prisma.booking.findMany({
            where: {
                user_id: userId,
                ...(excludeBookingId && { NOT: { id: excludeBookingId } }),
                starts_at: { lte: new Date(endTime.getTime() + bufferAfter * 60000) },
                ends_at: { gte: new Date(startTime.getTime() - bufferBefore * 60000) }
            },
            select: { starts_at: true, ends_at: true }
        });
        const hasConflict = overlapping.some(b => {
            const bookingStart = b.starts_at;
            const bookingEnd = b.ends_at;
            if (startTime < bookingEnd && endTime > bookingStart)
                return true;
            const bookingBufferStart = new Date(bookingStart.getTime() - bufferBefore * 60000);
            const bookingBufferEnd = new Date(bookingEnd.getTime() + bufferAfter * 60000);
            return startTime < bookingBufferEnd && endTime > bookingBufferStart;
        });
        return !hasConflict;
    }
    async generateAvailableSlots(userId, date, duration, bufferBefore = 0, bufferAfter = 0, advanceNotice = 0, slotInterval = 30, excludeBookingId) {
        const dayOfWeek = date.getUTCDay();
        const rules = await this.getAvailabilityRules(userId);
        const dayRules = rules.filter(rule => rule.dayOfWeek === dayOfWeek);
        if (dayRules.length === 0) {
            return [];
        }
        const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
        const dayEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));
        const extendedStart = new Date(dayStart.getTime() - (bufferAfter || 0) * 60000);
        const extendedEnd = new Date(dayEnd.getTime() + (bufferBefore || 0) * 60000);
        const existingBookings = await this.getExistingBookings(userId, extendedStart, extendedEnd, excludeBookingId);
        const overrides = await this.getAvailabilityOverrides(userId, dayStart, dayEnd);
        const slots = [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isToday = date >= today && date < tomorrow;
        for (const rule of dayRules) {
            const ruleStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, rule.startMinute));
            const ruleEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, rule.endMinute));
            let effectiveStart = ruleStart;
            if (isToday && advanceNotice > 0) {
                const earliestAllowed = new Date(now.getTime() + advanceNotice * 60000);
                effectiveStart = new Date(Math.max(ruleStart.getTime(), earliestAllowed.getTime()));
            }
            {
                const minutesFromMidnight = effectiveStart.getUTCHours() * 60 + effectiveStart.getUTCMinutes();
                const deltaFromRuleStart = minutesFromMidnight - rule.startMinute;
                const remainder = ((deltaFromRuleStart % slotInterval) + slotInterval) % slotInterval;
                const adjustment = remainder === 0 ? 0 : (slotInterval - remainder);
                if (adjustment > 0) {
                    effectiveStart = new Date(effectiveStart.getTime() + adjustment * 60000);
                }
            }
            let currentTime = new Date(effectiveStart);
            while (currentTime.getTime() + duration * 60000 <= ruleEnd.getTime()) {
                const slotStart = new Date(currentTime);
                const slotEnd = new Date(currentTime.getTime() + duration * 60000);
                const fastAvailable = this.checkSlotAvailability(slotStart, slotEnd, new Date(slotStart.getTime() - bufferBefore * 60000), new Date(slotEnd.getTime() + bufferAfter * 60000), existingBookings, overrides, date, rule, bufferBefore, bufferAfter);
                const dbAvailable = await this.isSlotAvailable(userId, slotStart, slotEnd, excludeBookingId, bufferBefore, bufferAfter);
                slots.push({
                    start: slotStart,
                    end: slotEnd,
                    isAvailable: fastAvailable && dbAvailable
                });
                currentTime = new Date(currentTime.getTime() + slotInterval * 60000);
            }
        }
        return slots.filter(slot => slot.isAvailable);
    }
    checkSlotAvailability(slotStart, slotEnd, bufferStart, bufferEnd, existingBookings, overrides, date, rule, bufferBefore, bufferAfter) {
        const slotStartMinute = slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes();
        const slotEndMinute = slotEnd.getUTCHours() * 60 + slotEnd.getUTCMinutes();
        if (slotStartMinute < rule.startMinute || slotEndMinute > rule.endMinute) {
            return false;
        }
        const dateStr = date.toISOString().split('T')[0];
        const dayOverride = overrides.find(o => o.date.toISOString().split('T')[0] === dateStr);
        if (dayOverride) {
            if (dayOverride.isBusy) {
                return false;
            }
            if (dayOverride.startMinute !== undefined && slotStartMinute < dayOverride.startMinute) {
                return false;
            }
            if (dayOverride.endMinute !== undefined && slotEndMinute > dayOverride.endMinute) {
                return false;
            }
        }
        const hasConflict = existingBookings.some(booking => {
            const directOverlap = slotStart < booking.end && slotEnd > booking.start;
            if (directOverlap)
                return true;
            const bookingBufferStart = new Date(booking.start.getTime() - bufferBefore * 60000);
            const bookingBufferEnd = new Date(booking.end.getTime() + bufferAfter * 60000);
            return slotStart < bookingBufferEnd && slotEnd > bookingBufferStart;
        });
        return !hasConflict;
    }
    async updateAvailabilityRules(userId, rules) {
        await this.prisma.$transaction(async (tx) => {
            await tx.availabilityRule.deleteMany({
                where: { user_id: userId }
            });
            if (rules.length > 0) {
                await tx.availabilityRule.createMany({
                    data: rules.map(rule => ({
                        user_id: userId,
                        day_of_week: rule.dayOfWeek,
                        start_minute: rule.startMinute,
                        end_minute: rule.endMinute
                    }))
                });
            }
        });
    }
};
exports.AvailabilityService = AvailabilityService;
exports.AvailabilityService = AvailabilityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AvailabilityService);
//# sourceMappingURL=availability.service.js.map
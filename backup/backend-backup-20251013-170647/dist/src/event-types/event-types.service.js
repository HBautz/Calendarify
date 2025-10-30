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
exports.EventTypesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const availability_service_1 = require("../availability/availability.service");
const slug_utils_1 = require("./slug.utils");
let EventTypesService = class EventTypesService {
    prisma;
    availabilityService;
    constructor(prisma, availabilityService) {
        this.prisma = prisma;
        this.availabilityService = availabilityService;
    }
    async list(userId) {
        const events = await this.prisma.eventType.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'asc' }
        });
        return events.map(this.mapToEventType);
    }
    async create(userId, data) {
        const slug = await (0, slug_utils_1.generateUniqueSlug)(this.prisma, data.slug || data.title);
        const requiredFieldsMerged = {
            ...(data.requiredFields ?? {}),
            ...(data.bookingLimit !== undefined ? { bookingLimit: data.bookingLimit } : {})
        };
        const eventType = await this.prisma.eventType.create({
            data: {
                user_id: userId,
                slug,
                title: data.title,
                description: data.description,
                duration: data.duration,
                buffer_before: data.bufferBefore ?? 0,
                buffer_after: data.bufferAfter ?? 0,
                advance_notice: data.advanceNotice ?? 0,
                slot_interval: data.slotInterval ?? 30,
                questions: data.questions ?? [],
                required_fields: requiredFieldsMerged,
                confirmation_message: data.confirmationMessage ?? '',
            },
        });
        return this.mapToEventType(eventType);
    }
    async findOne(id) {
        const eventType = await this.prisma.eventType.findUnique({
            where: { id }
        });
        return eventType ? this.mapToEventType(eventType) : null;
    }
    async findBySlug(slug) {
        const eventType = await this.prisma.eventType.findUnique({
            where: { slug },
            include: {
                user: {
                    select: {
                        display_name: true
                    }
                }
            }
        });
        if (!eventType) {
            return null;
        }
        const mapped = this.mapToEventType(eventType);
        try {
            const state = await this.prisma.userState.findUnique({ where: { user_id: eventType.user_id } });
            const data = state?.data || {};
            const settingsKey = `event-type-settings-${eventType.id}`;
            const settings = data[settingsKey] || {};
            const legacyLocation = settings.location;
            const locations = Array.isArray(settings.locations)
                ? settings.locations
                : legacyLocation
                    ? [legacyLocation]
                    : [];
            mapped.locations = locations;
            mapped.customLocation = settings.customLocation || '';
            mapped.link = settings.link || '';
            mapped.tags = Array.isArray(settings.tags) ? settings.tags : [];
            mapped.addToContacts = settings.addToContacts === true || (mapped.tags?.length > 0);
        }
        catch (e) {
        }
        return mapped;
    }
    async update(id, data, userId) {
        const existingEventType = await this.prisma.eventType.findUnique({
            where: { id }
        });
        if (!existingEventType) {
            throw new common_1.NotFoundException(`Event type with id ${id} not found`);
        }
        let slug = existingEventType.slug;
        if (data.title || data.slug) {
            const source = data.slug || data.title;
            slug = await (0, slug_utils_1.generateUniqueSlug)(this.prisma, source, id);
        }
        let requiredFieldsUpdate = undefined;
        if (data.requiredFields !== undefined || data.bookingLimit !== undefined) {
            const existing = await this.prisma.eventType.findUnique({ where: { id } });
            const existingRequired = existing?.required_fields || {};
            requiredFieldsUpdate = {
                ...existingRequired,
                ...(data.requiredFields !== undefined ? data.requiredFields : {}),
                ...(data.bookingLimit !== undefined ? { bookingLimit: data.bookingLimit } : {})
            };
        }
        const updatedEventType = await this.prisma.eventType.update({
            where: { id },
            data: {
                ...(data.title && { title: data.title }),
                ...(slug !== existingEventType.slug && { slug }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.duration !== undefined && { duration: data.duration }),
                ...(data.bufferBefore !== undefined && { buffer_before: data.bufferBefore }),
                ...(data.bufferAfter !== undefined && { buffer_after: data.bufferAfter }),
                ...(data.advanceNotice !== undefined && { advance_notice: data.advanceNotice }),
                ...(data.slotInterval !== undefined && { slot_interval: data.slotInterval }),
                ...(data.questions !== undefined && { questions: data.questions }),
                ...(requiredFieldsUpdate !== undefined && { required_fields: requiredFieldsUpdate }),
                ...(data.confirmationMessage !== undefined && { confirmation_message: data.confirmationMessage }),
            },
        });
        return this.mapToEventType(updatedEventType);
    }
    async remove(id) {
        await this.prisma.eventType.delete({
            where: { id }
        });
    }
    async getAvailableSlots(slug, date, excludeBookingId) {
        const eventType = await this.findBySlug(slug);
        if (!eventType) {
            throw new common_1.NotFoundException(`Event type with slug ${slug} not found`);
        }
        const bookingLimit = eventType.bookingLimit;
        if (bookingLimit && typeof bookingLimit === 'object' && bookingLimit.count > 0) {
            const startWindow = new Date(date);
            startWindow.setHours(0, 0, 0, 0);
            let endWindow = new Date(startWindow);
            if (bookingLimit.period === 'week') {
                endWindow = new Date(startWindow.getTime() + 7 * 24 * 60 * 60000);
            }
            else {
                endWindow = new Date(startWindow.getTime() + 24 * 60 * 60000);
            }
            const count = await this.prisma.booking.count({
                where: {
                    event_type_id: eventType.id,
                    starts_at: { gte: startWindow },
                    ends_at: { lt: endWindow },
                }
            });
            if (count >= bookingLimit.count) {
                return [];
            }
        }
        const slots = await this.availabilityService.generateAvailableSlots(eventType.userId, date, eventType.duration, eventType.bufferBefore, eventType.bufferAfter, eventType.advanceNotice, eventType.slotInterval, excludeBookingId);
        return slots.map(slot => slot.start.toISOString());
    }
    async createBooking(slug, data) {
        const eventType = await this.findBySlug(slug);
        if (!eventType) {
            throw new common_1.NotFoundException(`Event type with slug ${slug} not found`);
        }
        const startTime = new Date(data.start);
        const endTime = new Date(data.end);
        return await this.prisma.$transaction(async (tx) => {
            const isAvailable = await this.availabilityService.isSlotAvailable(eventType.userId, startTime, endTime, data.excludeBookingId);
            if (!isAvailable) {
                throw new common_1.HttpException('Selected time slot is not available', common_1.HttpStatus.CONFLICT);
            }
            const booking = await tx.booking.create({
                data: {
                    event_type_id: eventType.id,
                    user_id: eventType.userId,
                    name: data.name,
                    email: data.email,
                    starts_at: startTime,
                    ends_at: endTime,
                },
            });
            return booking;
        });
    }
    mapToEventType(dbRecord) {
        return {
            id: dbRecord.id,
            userId: dbRecord.user_id,
            userDisplayName: dbRecord.user?.display_name,
            slug: dbRecord.slug,
            title: dbRecord.title,
            description: dbRecord.description,
            duration: dbRecord.duration,
            bufferBefore: dbRecord.buffer_before,
            bufferAfter: dbRecord.buffer_after,
            advanceNotice: dbRecord.advance_notice,
            slotInterval: dbRecord.slot_interval,
            questions: dbRecord.questions,
            requiredFields: dbRecord.required_fields,
            confirmationMessage: dbRecord.confirmation_message,
            bookingLimit: dbRecord.required_fields?.bookingLimit,
        };
    }
};
exports.EventTypesService = EventTypesService;
exports.EventTypesService = EventTypesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        availability_service_1.AvailabilityService])
], EventTypesService);
//# sourceMappingURL=event-types.service.js.map
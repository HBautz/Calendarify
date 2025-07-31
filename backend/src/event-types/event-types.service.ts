import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { generateUniqueSlug } from './slug.utils';
import { generateSlots } from './slot.utils';

export interface EventType {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description?: string;
  duration: number;
  buffer_before?: number;
  buffer_after?: number;
  advance_notice?: number;
  slot_interval: number;
}

@Injectable()
export class EventTypesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.eventType.findMany({ where: { user_id: userId }, orderBy: { created_at: 'asc' } })
      .then(events => events.map(event => ({
        ...event,
        bufferBefore: event.buffer_before,
        bufferAfter: event.buffer_after,
        advanceNotice: event.advance_notice,
      })));
  }

  async create(userId: string, data: any) {
    const slug = await generateUniqueSlug(this.prisma, data.slug || data.title);
    
    // Map frontend field names to database field names
    const mappedData: any = { ...data };
    
    // Map requiredFields to required_fields
    if (data.requiredFields !== undefined) {
      mappedData.required_fields = data.requiredFields;
      delete mappedData.requiredFields;
    }
    
    // Map confirmationMessage to confirmation_message
    if (data.confirmationMessage !== undefined) {
      mappedData.confirmation_message = data.confirmationMessage;
      delete mappedData.confirmationMessage;
    }
    
    // questions field is already correct, no mapping needed
    
    return this.prisma.eventType.create({
      data: {
        user_id: userId,
        ...mappedData,
        buffer_before: data.buffer_before ?? 0,
        buffer_after: data.buffer_after ?? 0,
        advance_notice: data.advance_notice ?? 0,
        slot_interval: data.slot_interval ?? 30,
        slug,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.eventType.findUnique({ where: { id } })
      .then(event => event ? {
        ...event,
        bufferBefore: event.buffer_before,
        bufferAfter: event.buffer_after,
        advanceNotice: event.advance_notice,
      } : null);
  }

  findBySlug(slug: string) {
    return this.prisma.eventType.findUnique({ where: { slug } })
      .then(event => event ? {
        ...event,
        bufferBefore: event.buffer_before,
        bufferAfter: event.buffer_after,
        advanceNotice: event.advance_notice,
      } : null);
  }

  async update(id: string, data: any, userId?: string) {
    // First check if the event type exists
    const existingEventType = await this.prisma.eventType.findUnique({ where: { id } });
    
    if (!existingEventType) {
      // If event type doesn't exist, create it instead
      console.log(`Event type with id ${id} not found, creating new one`);
      return this.create(userId || 'default-user-id', data);
    }
    
    if (data.title || data.slug) {
      const source = data.slug || data.title!;
      data.slug = await generateUniqueSlug(this.prisma, source, id);
    }
    
    // Map frontend field names to database field names
    const mappedData: any = { ...data };
    
    // Map requiredFields to required_fields
    if (data.requiredFields !== undefined) {
      mappedData.required_fields = data.requiredFields;
      delete mappedData.requiredFields;
    }
    
    // Map confirmationMessage to confirmation_message
    if (data.confirmationMessage !== undefined) {
      mappedData.confirmation_message = data.confirmationMessage;
      delete mappedData.confirmationMessage;
    }
    
    // questions field is already correct, no mapping needed
    
    return this.prisma.eventType.update({ where: { id }, data: mappedData });
  }

  remove(id: string) {
    return this.prisma.eventType.delete({ where: { id } });
  }

  async availableSlots(slug: string, date: Date, exclude?: string) {
    const et = await this.prisma.eventType.findUnique({ where: { slug } });
    if (!et) return [];

    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));

    // Get existing bookings for this event type that could affect this date
    // We need to find ALL bookings, not just those on this specific date
    // because buffers can extend across multiple days
    const bookings = await this.prisma.booking.findMany({
      where: {
        event_type_id: et.id,
        ...(exclude ? { NOT: { id: exclude } } : {}),
      },
    });

    // Create busy periods (buffers will be applied in slot generation)
    const busy = bookings.map(b => ({
      start: new Date(b.starts_at),
      end: new Date(b.ends_at),
    }));

    // Get user's availability rules for this day of week
    const dayOfWeek = start.getUTCDay();
    const availabilityRules = await this.prisma.availabilityRule.findMany({
      where: {
        user_id: et.user_id,
        day_of_week: dayOfWeek,
      },
    });

    // Get any overrides for this specific date
    const overrides = await this.prisma.availabilityOverride.findMany({
      where: {
        user_id: et.user_id,
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    // Convert availability rules to slot generation format
    const rules = availabilityRules.map(rule => ({
      dayOfWeek: rule.day_of_week,
      startMinute: rule.start_minute,
      endMinute: rule.end_minute - et.duration, // Subtract event duration
    }));

    // Convert overrides to slot generation format
    const slotOverrides = overrides.map(override => ({
      date: override.date,
      startMinute: override.start_minute || undefined,
      endMinute: override.end_minute ? override.end_minute - et.duration : undefined,
      isBusy: override.is_busy,
    }));

    // If no availability rules found, use default 9 AM - 5 PM
    if (rules.length === 0) {
      rules.push({
        dayOfWeek: dayOfWeek,
        startMinute: 9 * 60, // 9 AM
        endMinute: 17 * 60 - et.duration, // 5 PM minus duration
      });
    }

    // Buffer settings debug (only log if there are busy periods)
    if (busy.length > 0) {
      console.log('[BUFFER-DEBUG] Event type settings:', {
        bufferBefore: et.buffer_before,
        bufferAfter: et.buffer_after,
        duration: et.duration,
        busyPeriods: busy.length
      });
    }
    
    let slots = generateSlots({
      from: start,
      to: end,
      duration: et.duration,
      timezone: 'UTC',
      rules: rules,
      overrides: slotOverrides,
      busy: busy,
      bufferBefore: et.buffer_before,
      bufferAfter: et.buffer_after,
      slotInterval: (et as any).slot_interval || et.duration,
    });

    // Apply advance notice filter
    const now = new Date();
    const earliest = new Date(now.getTime() + et.advance_notice * 60000);
    
    const slotsBeforeAdvanceNotice = slots.length;
    
    // For advance notice, we want to ensure slots are only available after the advance notice period
    // If advance notice is 1 day, slots should only be available starting from tomorrow at the same time
    slots = slots.filter(s => {
      const slotTime = new Date(s);
      return slotTime >= earliest;
    });
    
    // Only log if advance notice actually filtered out slots
    if (slots.length < slotsBeforeAdvanceNotice) {
      console.log('[ADVANCE-NOTICE-DEBUG] Filtered out', slotsBeforeAdvanceNotice - slots.length, 'slots due to advance notice:', {
        advanceNotice: `${et.advance_notice}min`,
        earliestAllowed: earliest.toISOString()
      });
    }

    return slots;
  }

  async book(slug: string, data: { name: string; email: string; start: string; end: string }) {
    const et = await this.prisma.eventType.findUnique({ where: { slug } });
    if (!et) throw new Error('event type not found');
    return this.prisma.booking.create({
      data: {
        event_type_id: et.id,
        user_id: et.user_id,
        name: data.name,
        email: data.email,
        starts_at: new Date(data.start),
        ends_at: new Date(data.end),
      },
    });
  }
}

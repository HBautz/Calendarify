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
}

@Injectable()
export class EventTypesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.eventType.findMany({ where: { user_id: userId }, orderBy: { created_at: 'asc' } });
  }

  async create(userId: string, data: Omit<EventType, 'id' | 'userId'>) {
    const slug = await generateUniqueSlug(this.prisma, data.slug || data.title);
    return this.prisma.eventType.create({
      data: {
        user_id: userId,
        ...data,
        buffer_before: data.buffer_before ?? 0,
        buffer_after: data.buffer_after ?? 0,
        advance_notice: data.advance_notice ?? 0,
        slug,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.eventType.findUnique({ where: { id } });
  }

  findBySlug(slug: string) {
    return this.prisma.eventType.findUnique({ where: { slug } });
  }

  async update(id: string, data: Partial<EventType>) {
    if (data.title || data.slug) {
      const source = data.slug || data.title!;
      data.slug = await generateUniqueSlug(this.prisma, source, id);
    }
    return this.prisma.eventType.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.eventType.delete({ where: { id } });
  }

  async availableSlots(slug: string, date: Date) {
    const et = await this.prisma.eventType.findUnique({ where: { slug } });
    if (!et) return [];

    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));

    const bookings = await this.prisma.booking.findMany({
      where: {
        event_type_id: et.id,
        starts_at: { gte: start },
        ends_at: { lte: end },
      },
    });

    const busy = bookings.map(b => ({
      start: new Date(b.starts_at.getTime() - et.buffer_before * 60000),
      end: new Date(b.ends_at.getTime() + et.buffer_after * 60000),
    }));

    const dayRule = {
      dayOfWeek: start.getUTCDay(),
      startMinute: 9 * 60,
      endMinute: 17 * 60 - et.duration,
    };

    let slots = generateSlots({
      from: start,
      to: end,
      duration: et.duration,
      timezone: 'UTC',
      rules: [dayRule],
      overrides: [],
      busy,
    });

    const earliest = new Date(Date.now() + et.advance_notice * 60000);
    slots = slots.filter(s => new Date(s) >= earliest);
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

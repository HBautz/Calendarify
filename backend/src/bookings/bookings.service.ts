import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventTypesService } from '../event-types/event-types.service';
import { AvailabilityService } from '../availability/availability.service';

interface CreateBookingDto {
  event_type_id: string;
  user_id: string;
  name: string;
  email: string;
  starts_at: Date;
  ends_at: Date;
}

interface CreatePublicBookingDto {
  event_type_slug: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  starts_at: string;
  ends_at: string;
  questions?: any[];
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private eventTypesService: EventTypesService,
    private availabilityService: AvailabilityService
  ) {}

  create(data: CreateBookingDto) {
    return this.prisma.booking.create({ data });
  }

  async createPublic(data: CreatePublicBookingDto) {
    // Find the event type by slug
    const eventType = await this.eventTypesService.findBySlug(data.event_type_slug);
    if (!eventType) {
      throw new Error('Event type not found');
    }

    // Parse requested times
    const startTime = new Date(data.starts_at);
    const endTime = new Date(data.ends_at);

    // Guard: ensure the requested slot is still available (prevents double booking)
    const isAvailable = await this.availabilityService.isSlotAvailable(
      eventType.userId,
      startTime,
      endTime,
      undefined,
      eventType.bufferBefore,
      eventType.bufferAfter
    );

    if (!isAvailable) {
      throw new Error('Selected time slot is not available');
    }

    // Enforce booking limit for the event type
    const limit = (eventType as any).bookingLimit;
    if (limit && typeof limit === 'object' && limit.count > 0) {
      const startWindow = new Date(startTime);
      startWindow.setHours(0, 0, 0, 0);
      let endWindow = new Date(startWindow);
      if (limit.period === 'week') {
        endWindow = new Date(startWindow.getTime() + 7 * 24 * 60 * 60000);
      } else {
        endWindow = new Date(startWindow.getTime() + 24 * 60 * 60000);
      }
      const count = await this.prisma.booking.count({
        where: {
          event_type_id: eventType.id,
          starts_at: { gte: startWindow },
          ends_at: { lt: endWindow },
        }
      });
      if (count >= limit.count) {
        throw new Error('Booking limit reached for this period');
      }
    }

    // Create the booking
    const booking = await this.prisma.booking.create({
      data: {
        event_type_id: eventType.id,
        user_id: eventType.userId,
        name: data.name,
        email: data.email,
        starts_at: startTime,
        ends_at: endTime,
      },
      include: {
        event_type: true,
      },
    });

    // TODO: Add support for phone, company, and questions in a future update
    // For now, we'll store this data in the booking notes table
    // This requires fixing the Prisma client types

    return booking;
  }

  findForUser(userId: string) {
    return this.prisma.booking.findMany({
      where: { user_id: userId },
      include: { 
        event_type: true,
        notes: true,
      },
      orderBy: { starts_at: 'asc' },
    });
  }

  remove(id: string) {
    return this.prisma.booking.delete({ where: { id } });
  }

  update(id: string, data: { start: string; end: string }) {
    console.log('[DEBUG] Updating booking:', { id, data });
    
    const updatedBooking = this.prisma.booking.update({
      where: { id },
      data: {
        starts_at: new Date(data.start),
        ends_at: new Date(data.end),
      },
      include: { event_type: true },
    });
    
    console.log('[DEBUG] Updated booking result:', updatedBooking);
    return updatedBooking;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventTypesService } from '../event-types/event-types.service';

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
    private eventTypesService: EventTypesService
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

    // Create the booking
    const booking = await this.prisma.booking.create({
      data: {
        event_type_id: eventType.id,
        user_id: eventType.user_id,
        name: data.name,
        email: data.email,
        starts_at: new Date(data.starts_at),
        ends_at: new Date(data.ends_at),
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

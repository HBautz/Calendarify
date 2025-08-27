import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { generateUniqueSlug } from './slug.utils';

export interface EventType {
  id: string;
  userId: string;
  userDisplayName?: string;
  slug: string;
  title: string;
  description?: string;
  duration: number;
  bufferBefore: number;
  bufferAfter: number;
  advanceNotice: number;
  slotInterval: number;
  questions?: any[];
  requiredFields?: any;
  confirmationMessage?: string;
}

export interface CreateEventTypeData {
  title: string;
  slug?: string;
  description?: string;
  duration: number;
  bufferBefore?: number;
  bufferAfter?: number;
  advanceNotice?: number;
  slotInterval?: number;
  questions?: any[];
  requiredFields?: any;
  confirmationMessage?: string;
}

@Injectable()
export class EventTypesService {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService
  ) {}

  /**
   * List all event types for a user
   */
  async list(userId: string): Promise<EventType[]> {
    const events = await this.prisma.eventType.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' }
    });

    return events.map(this.mapToEventType);
  }

  /**
   * Create a new event type
   */
  async create(userId: string, data: CreateEventTypeData): Promise<EventType> {
    const slug = await generateUniqueSlug(this.prisma, data.slug || data.title);
    
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
        required_fields: data.requiredFields ?? {},
        confirmation_message: data.confirmationMessage ?? '',
      },
    });

    return this.mapToEventType(eventType);
  }

  /**
   * Find event type by ID
   */
  async findOne(id: string): Promise<EventType | null> {
    const eventType = await this.prisma.eventType.findUnique({
      where: { id }
    });

    return eventType ? this.mapToEventType(eventType) : null;
  }

  /**
   * Find event type by slug
   */
  async findBySlug(slug: string): Promise<EventType | null> {
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

    return eventType ? this.mapToEventType(eventType) : null;
  }

  /**
   * Update an event type
   */
  async update(id: string, data: Partial<CreateEventTypeData>, userId?: string): Promise<EventType> {
    const existingEventType = await this.prisma.eventType.findUnique({
      where: { id }
    });

    if (!existingEventType) {
      throw new NotFoundException(`Event type with id ${id} not found`);
    }

    // Generate new slug if title or slug changed
    let slug = existingEventType.slug;
    if (data.title || data.slug) {
      const source = data.slug || data.title!;
      slug = await generateUniqueSlug(this.prisma, source, id);
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
        ...(data.requiredFields !== undefined && { required_fields: data.requiredFields }),
        ...(data.confirmationMessage !== undefined && { confirmation_message: data.confirmationMessage }),
      },
    });

    return this.mapToEventType(updatedEventType);
  }

  /**
   * Delete an event type
   */
  async remove(id: string): Promise<void> {
    await this.prisma.eventType.delete({
      where: { id }
    });
  }

  /**
   * Get available time slots for an event type on a specific date
   */
  async getAvailableSlots(
    slug: string, 
    date: Date, 
    excludeBookingId?: string
  ): Promise<string[]> {
    const eventType = await this.findBySlug(slug);
    if (!eventType) {
      throw new NotFoundException(`Event type with slug ${slug} not found`);
    }

    const slots = await this.availabilityService.generateAvailableSlots(
      eventType.userId,
      date,
      eventType.duration,
      eventType.bufferBefore,
      eventType.bufferAfter,
      eventType.advanceNotice,
      eventType.slotInterval,
      excludeBookingId
    );

    // Convert to ISO strings for API response
    return slots.map(slot => slot.start.toISOString());
  }

  /**
   * Create a booking for an event type
   */
  async createBooking(
    slug: string, 
    data: { 
      name: string; 
      email: string; 
      start: string; 
      end: string;
      questions?: any[];
      excludeBookingId?: string;
    }
  ): Promise<any> {
    const eventType = await this.findBySlug(slug);
    if (!eventType) {
      throw new NotFoundException(`Event type with slug ${slug} not found`);
    }

    const startTime = new Date(data.start);
    const endTime = new Date(data.end);

    // Use database transaction to prevent race conditions
    return await this.prisma.$transaction(async (tx) => {
      // Check availability within the transaction
      const isAvailable = await this.availabilityService.isSlotAvailable(
        eventType.userId,
        startTime,
        endTime,
        data.excludeBookingId
      );

      if (!isAvailable) {
        throw new HttpException('Selected time slot is not available', HttpStatus.CONFLICT);
      }

      // Create the booking within the same transaction
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

  /**
   * Helper method to map database record to EventType interface
   */
  private mapToEventType(dbRecord: any): EventType {
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
    };
  }
}

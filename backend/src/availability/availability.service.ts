import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface AvailabilityRule {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface AvailabilityOverride {
  date: Date;
  startMinute?: number;
  endMinute?: number;
  isBusy: boolean;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  isAvailable: boolean;
}

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get availability rules for a user
   */
  async getAvailabilityRules(userId: string): Promise<AvailabilityRule[]> {
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

  /**
   * Get availability overrides for a date range
   */
  async getAvailabilityOverrides(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<AvailabilityOverride[]> {
    const overrides = await this.prisma.availabilityOverride.findMany({
      where: {
        user_id: userId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    return overrides.map(override => ({
      date: override.date,
      startMinute: override.start_minute || undefined,
      endMinute: override.end_minute || undefined,
      isBusy: override.is_busy
    }));
  }

  /**
   * Get existing bookings for a user in a date range
   */
  async getExistingBookings(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeBookingId?: string
  ): Promise<{ start: Date; end: Date }[]> {
    // Fetch bookings that overlap the given window (not just fully within)
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

  /**
   * Check if a specific time slot is available
   */
  async isSlotAvailable(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string
  ): Promise<boolean> {
    // Check if the time falls within availability rules
    const dayOfWeek = startTime.getUTCDay();
    const startMinute = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
    const endMinute = endTime.getUTCHours() * 60 + endTime.getUTCMinutes();

    const rules = await this.getAvailabilityRules(userId);
    const dayRules = rules.filter(rule => rule.dayOfWeek === dayOfWeek);

    if (dayRules.length === 0) {
      return false; // No availability rules for this day
    }

    // Check if any rule covers this time slot (slot must be completely within a rule)
    const isWithinRules = dayRules.some(rule => 
      startMinute >= rule.startMinute && endMinute <= rule.endMinute
    );

    if (!isWithinRules) {
      return false;
    }

    // Check for overrides
    const dateStr = startTime.toISOString().split('T')[0];
    const overrides = await this.getAvailabilityOverrides(
      userId,
      new Date(dateStr),
      new Date(dateStr)
    );

    const dayOverride = overrides.find(o => 
      o.date.toISOString().split('T')[0] === dateStr
    );

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

    // Check for conflicting bookings
    const conflictingBookings = await this.prisma.booking.findFirst({
      where: {
        user_id: userId,
        ...(excludeBookingId && { NOT: { id: excludeBookingId } }),
        OR: [
          {
            starts_at: { lt: endTime },
            ends_at: { gt: startTime }
          }
        ]
      }
    });

    return !conflictingBookings;
  }

  /**
   * Generate available time slots for a specific date
   */
  async generateAvailableSlots(
    userId: string,
    date: Date,
    duration: number,
    bufferBefore: number = 0,
    bufferAfter: number = 0,
    advanceNotice: number = 0,
    slotInterval: number = 30,
    excludeBookingId?: string
  ): Promise<TimeSlot[]> {
    const dayOfWeek = date.getUTCDay();
    const rules = await this.getAvailabilityRules(userId);
    const dayRules = rules.filter(rule => rule.dayOfWeek === dayOfWeek);

    if (dayRules.length === 0) {
      return [];
    }

    // Pre-fetch potentially conflicting bookings with an extended window
    // Extend backwards by bufferAfter (so prior-day bookings with long bufferAfter are included)
    // and forwards by bufferBefore (so next-day bookings with long bufferBefore are included)
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
    const dayEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));
    const extendedStart = new Date(dayStart.getTime() - (bufferAfter || 0) * 60000);
    const extendedEnd = new Date(dayEnd.getTime() + (bufferBefore || 0) * 60000);

    const existingBookings = await this.getExistingBookings(userId, extendedStart, extendedEnd, excludeBookingId);
    const overrides = await this.getAvailabilityOverrides(userId, dayStart, dayEnd);

    const slots: TimeSlot[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isToday = date >= today && date < tomorrow;

    for (const rule of dayRules) {
      const ruleStart = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        rule.startMinute
      ));

      const ruleEnd = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        rule.endMinute
      ));

      // Apply advance notice only for today, then align to slot grid
      let effectiveStart = ruleStart;
      if (isToday && advanceNotice > 0) {
        const earliestAllowed = new Date(now.getTime() + advanceNotice * 60000);
        effectiveStart = new Date(Math.max(ruleStart.getTime(), earliestAllowed.getTime()));
      }

      // Align effectiveStart to the next slot interval boundary relative to the rule start
      // This prevents odd minute offsets like :23 when advanceNotice pushes into the middle of an interval
      {
        const minutesFromMidnight = effectiveStart.getUTCHours() * 60 + effectiveStart.getUTCMinutes();
        const deltaFromRuleStart = minutesFromMidnight - rule.startMinute;
        const remainder = ((deltaFromRuleStart % slotInterval) + slotInterval) % slotInterval;
        const adjustment = remainder === 0 ? 0 : (slotInterval - remainder);
        if (adjustment > 0) {
          effectiveStart = new Date(effectiveStart.getTime() + adjustment * 60000);
        }
      }

      // Generate slots
      let currentTime = new Date(effectiveStart);
      while (currentTime.getTime() + duration * 60000 <= ruleEnd.getTime()) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(currentTime.getTime() + duration * 60000);

        // Robust availability check using DB-backed method to avoid edge-case mismatches
        // This ensures no stale or missed overlaps, at the cost of a DB read per candidate
        // If performance becomes an issue, retain pre-fetched check as a fast-path and fall back on this as a secondary guard
        // const fastAvailable = this.checkSlotAvailability(...);
        const isAvailable = await this.isSlotAvailable(
          userId,
          slotStart,
          slotEnd,
          excludeBookingId
        );

        slots.push({
          start: slotStart,
          end: slotEnd,
          isAvailable
        });

        // Move to next slot using the provided slot interval
        currentTime = new Date(currentTime.getTime() + slotInterval * 60000);
      }
    }

    return slots.filter(slot => slot.isAvailable);
  }

  /**
   * Check slot availability using pre-fetched data (no database queries)
   */
  private checkSlotAvailability(
    slotStart: Date,
    slotEnd: Date,
    bufferStart: Date,
    bufferEnd: Date,
    existingBookings: { start: Date; end: Date }[],
    overrides: AvailabilityOverride[],
    date: Date,
    rule: AvailabilityRule,
    bufferBefore: number,
    bufferAfter: number
  ): boolean {
    // Check if slot is within the availability rule
    const slotStartMinute = slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes();
    const slotEndMinute = slotEnd.getUTCHours() * 60 + slotEnd.getUTCMinutes();
    
    if (slotStartMinute < rule.startMinute || slotEndMinute > rule.endMinute) {
      return false;
    }

    // Check for overrides
    const dateStr = date.toISOString().split('T')[0];
    const dayOverride = overrides.find(o => 
      o.date.toISOString().split('T')[0] === dateStr
    );

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

    // Check for conflicting bookings (direct overlap and including buffers)
    const hasConflict = existingBookings.some(booking => {
      // Direct overlap with the booking itself
      const directOverlap = slotStart < booking.end && slotEnd > booking.start;
      if (directOverlap) return true;
      // Overlap with booking's buffer window
      const bookingBufferStart = new Date(booking.start.getTime() - bufferBefore * 60000);
      const bookingBufferEnd = new Date(booking.end.getTime() + bufferAfter * 60000);
      return slotStart < bookingBufferEnd && slotEnd > bookingBufferStart;
    });

    return !hasConflict;
  }

  /**
   * Update availability rules for a user
   */
  async updateAvailabilityRules(
    userId: string,
    rules: AvailabilityRule[]
  ): Promise<void> {
    // Wrap in database transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // Delete existing rules
      await tx.availabilityRule.deleteMany({
        where: { user_id: userId }
      });

      // Create new rules
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
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDatabaseStatus() {
    const [users, eventTypes, bookings, availabilityRules] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.eventType.count(),
      this.prisma.booking.count(),
      this.prisma.availabilityRule.count(),
    ]);

    return {
      users,
      eventTypes,
      bookings,
      availabilityRules,
    };
  }

  async wipeDatabase() {
    try {
      // Delete all data in the correct order to avoid foreign key constraints
      await this.prisma.bookingNote.deleteMany();
      await this.prisma.booking.deleteMany();
      await this.prisma.contactTag.deleteMany();
      await this.prisma.contact.deleteMany();
      await this.prisma.tag.deleteMany();
      await this.prisma.availabilityOverride.deleteMany();
      await this.prisma.availabilityRule.deleteMany();
      await this.prisma.userState.deleteMany();
      await this.prisma.workflow.deleteMany();
      await this.prisma.externalCalendar.deleteMany();
      await this.prisma.eventType.deleteMany();
      await this.prisma.user.deleteMany();

      return {
        success: true,
        message: 'Database wiped successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to wipe database: ${error.message}`);
    }
  }
} 
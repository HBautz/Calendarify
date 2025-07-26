import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserStateService {
  constructor(private prisma: PrismaService) {}

  async load(userId: string): Promise<any> {
    const state = await this.prisma.userState.findUnique({
      where: { user_id: userId },
    });
    let data = state?.data || {};
    // Add default weekly hours if missing or empty
    if (!data['calendarify-weekly-hours'] || Object.keys(data['calendarify-weekly-hours']).length === 0) {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const defaultWeekly = {};
      days.forEach(day => {
        defaultWeekly[day] = { start: '09:00', end: '17:00' };
      });
      data['calendarify-weekly-hours'] = defaultWeekly;
      // Save the new default to the database
      await this.save(userId, data);
    }
    return data;
  }

  async save(userId: string, data: any) {
    await this.prisma.userState.upsert({
      where: { user_id: userId },
      update: { data },
      create: { user_id: userId, data },
    });
  }

  async loadByDisplayName(displayName: string): Promise<any> {
    console.log('[TEMP-DEBUG] loadByDisplayName', displayName);
    const user = await this.prisma.user.findUnique({ where: { display_name: displayName } });
    if (!user) return {};
    return this.load(user.id);
  }
}

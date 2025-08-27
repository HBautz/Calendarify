import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserStateService {
  constructor(private prisma: PrismaService) {}

  // Helper function to convert UTC minutes to UTC time string (for booking page)
  private convertUTCMinutesToUTCTimeString(utcMinutes: number): string {
    const utcHours = Math.floor(utcMinutes / 60);
    const utcMins = utcMinutes % 60;
    
    return `${utcHours.toString().padStart(2, '0')}:${utcMins.toString().padStart(2, '0')}`;
  }

  async load(userId: string): Promise<any> {
    const state = await this.prisma.userState.findUnique({
      where: { user_id: userId },
    });
    let data = state?.data || {};
    
    // No default availability - if missing, leave it empty
    if (!data['calendarify-weekly-hours']) {
      data['calendarify-weekly-hours'] = {};
    }

    // Load availability rules from database and convert to frontend format
    const availabilityRules = await this.prisma.availabilityRule.findMany({
      where: { user_id: userId },
    });


    // Convert availability rules to frontend day availability format
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayAvailability = {};
    
    // No default availability - all days start as unavailable
    dayNames.forEach(day => {
      dayAvailability[day] = false;
    });

    // Only days with availability rules are available
    if (availabilityRules.length > 0) {
      availabilityRules.forEach(rule => {
        const dayName = dayNames[rule.day_of_week];
        dayAvailability[dayName] = true;
      });
    }

    data['calendarify-day-availability'] = dayAvailability;

    // Convert availability rules to weekly hours in local time
    if (availabilityRules.length > 0) {
      const weeklyHours = {};
      
      availabilityRules.forEach(rule => {
        const dayName = dayNames[rule.day_of_week];
        const utcStart = this.convertUTCMinutesToUTCTimeString(rule.start_minute);
        const utcEnd = this.convertUTCMinutesToUTCTimeString(rule.end_minute);
        
        weeklyHours[dayName] = {
          start: utcStart,
          end: utcEnd
        };
        
      });
      
      data['calendarify-weekly-hours'] = weeklyHours;
    }

    return data;
  }

  async save(userId: string, data: any) {
    // First check if the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      console.log(`User with id ${userId} not found, skipping user state save`);
      return;
    }
    
    await this.prisma.userState.upsert({
      where: { user_id: userId },
      update: { data },
      create: { user_id: userId, data },
    });
  }

  async loadByDisplayName(displayName: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { display_name: displayName } });
    if (!user) return {};
    
    // Load the user state
    const state = await this.prisma.userState.findUnique({
      where: { user_id: user.id },
    });
    let data = state?.data || {};
    
    // No default availability - if missing, leave it empty
    if (!data['calendarify-weekly-hours']) {
      data['calendarify-weekly-hours'] = {};
    }

    // Load availability rules from database and convert to frontend format
    const availabilityRules = await this.prisma.availabilityRule.findMany({
      where: { user_id: user.id },
    });

    // Convert availability rules to frontend day availability format
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayAvailability = {};
    
    // No default availability - all days start as unavailable
    dayNames.forEach(day => {
      dayAvailability[day] = false;
    });

    // Only days with availability rules are available
    if (availabilityRules.length > 0) {
      availabilityRules.forEach(rule => {
        const dayName = dayNames[rule.day_of_week];
        dayAvailability[dayName] = true;
      });
    }

    data['calendarify-day-availability'] = dayAvailability;

    // Convert availability rules to weekly hours in local time
    if (availabilityRules.length > 0) {
      const weeklyHours = {};
      
      availabilityRules.forEach(rule => {
        const dayName = dayNames[rule.day_of_week];
        const utcStart = this.convertUTCMinutesToUTCTimeString(rule.start_minute);
        const utcEnd = this.convertUTCMinutesToUTCTimeString(rule.end_minute);
        
        weeklyHours[dayName] = {
          start: utcStart,
          end: utcEnd
        };
        
      });
      
      data['calendarify-weekly-hours'] = weeklyHours;
    }

    return data;
  }
}

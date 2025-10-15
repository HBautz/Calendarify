import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TestingService {
  constructor(private prisma: PrismaService) {}

  async getAvailability(userId: string) {
    const rules = await this.prisma.availabilityRule.findMany({
      where: { user_id: userId },
      orderBy: { day_of_week: 'asc' }
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const formattedRules = rules.map(rule => {
      const dayName = dayNames[rule.day_of_week];
      const startHours = Math.floor(rule.start_minute / 60);
      const startMinutes = rule.start_minute % 60;
      const endHours = Math.floor(rule.end_minute / 60);
      const endMinutes = rule.end_minute % 60;
      
      const startTime = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
      
      return {
        day: dayName,
        day_of_week: rule.day_of_week,
        start_time: startTime,
        end_time: endTime,
        start_minutes: rule.start_minute,
        end_minutes: rule.end_minute,
        utc_start: `${startTime} UTC`,
        utc_end: `${endTime} UTC`
      };
    });

    return {
      user_id: userId,
      total_rules: rules.length,
      rules: formattedRules,
      raw_data: rules
    };
  }

  async updateAvailability(userId: string, body: any) {
    const { day, start_time, end_time } = body;
    
    if (!day || !start_time || !end_time) {
      return {
        error: 'Missing required fields: day, start_time, end_time',
        example: {
          day: 'monday',
          start_time: '09:00',
          end_time: '17:00'
        }
      };
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = dayNames.indexOf(day.toLowerCase());
    
    if (dayIndex === -1) {
      return {
        error: 'Invalid day. Must be one of: sunday, monday, tuesday, wednesday, thursday, friday, saturday'
      };
    }

    // Convert time to minutes
    const startMinutes = this.timeToMinutes(start_time);
    const endMinutes = this.timeToMinutes(end_time);

    if (startMinutes === null || endMinutes === null) {
      return {
        error: 'Invalid time format. Use HH:MM format (e.g., 09:00, 17:30)'
      };
    }

    // Update or create the rule
    const rule = await this.prisma.availabilityRule.upsert({
      where: {
        id: `${userId}_${dayIndex}` // Use a simple unique identifier
      },
      update: {
        start_minute: startMinutes,
        end_minute: endMinutes
      },
      create: {
        user_id: userId,
        day_of_week: dayIndex,
        start_minute: startMinutes,
        end_minute: endMinutes
      }
    });

    return {
      success: true,
      message: `Updated ${day} availability`,
      rule: {
        day: dayNames[dayIndex],
        start_time: this.minutesToTime(startMinutes),
        end_time: this.minutesToTime(endMinutes),
        start_minutes: startMinutes,
        end_minutes: endMinutes
      }
    };
  }

  async getUserState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        availability_rules: true,
        user_state: true
      }
    });

    if (!user) {
      return { error: 'User not found' };
    }

    return {
      user_id: userId,
      email: user.email,
      display_name: user.display_name,
      availability_rules: user.availability_rules,
      user_state: user.user_state
    };
  }

  async updateUserState(userId: string, body: any) {
    const { key, value } = body;
    
    if (!key || value === undefined) {
      return {
        error: 'Missing required fields: key, value',
        example: {
          key: 'calendarify-weekly-hours',
          value: { monday: { start: '09:00', end: '17:00' } }
        }
      };
    }

    const existingUserState = await this.prisma.userState.findUnique({
      where: { user_id: userId }
    });

    const userState = await this.prisma.userState.upsert({
      where: { user_id: userId },
      update: {
        data: {
          ...(existingUserState?.data as any || {}),
          [key]: value
        }
      },
      create: {
        user_id: userId,
        data: { [key]: value }
      }
    });

    return {
      success: true,
      message: `Updated user state key: ${key}`,
      data: userState.data
    };
  }

  async testTimezone(body: any) {
    const { local_time, timezone_offset } = body;
    
    if (!local_time) {
      return {
        error: 'Missing local_time',
        example: {
          local_time: '09:00',
          timezone_offset: -120
        }
      };
    }

    const [hours, minutes] = local_time.split(':').map(Number);
    const offset = timezone_offset || 0; // Default to UTC

    // Convert local time to UTC
    const utcMinutes = hours * 60 + minutes - offset;
    const utcHours = Math.floor(utcMinutes / 60);
    const utcMins = utcMinutes % 60;
    const utcTime = `${utcHours.toString().padStart(2, '0')}:${utcMins.toString().padStart(2, '0')}`;

    // Convert UTC back to local time
    const localMinutes = utcMinutes + offset;
    const localHours = Math.floor(localMinutes / 60);
    const localMins = localMinutes % 60;
    const convertedLocalTime = `${localHours.toString().padStart(2, '0')}:${localMins.toString().padStart(2, '0')}`;

    return {
      input: {
        local_time,
        timezone_offset: offset
      },
      conversion: {
        utc_time: utcTime,
        utc_minutes: utcMinutes,
        converted_back_to_local: convertedLocalTime
      },
      timezone_info: {
        offset_minutes: offset,
        offset_hours: offset / 60
      }
    };
  }

  async getDebugInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        availability_rules: {
          orderBy: { day_of_week: 'asc' }
        },
        user_state: true
      }
    });

    if (!user) {
      return { error: 'User not found' };
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const availabilityInfo = user.availability_rules.map(rule => {
      const dayName = dayNames[rule.day_of_week];
      const startTime = this.minutesToTime(rule.start_minute);
      const endTime = this.minutesToTime(rule.end_minute);
      
      return {
        day: dayName,
        start_time: startTime,
        end_time: endTime,
        start_minutes: rule.start_minute,
        end_minutes: rule.end_minute
      };
    });

    return {
      user_info: {
        id: user.id,
        email: user.email,
        display_name: user.display_name
      },
      availability_rules: {
        count: user.availability_rules.length,
        rules: availabilityInfo
      },
      user_state: user.user_state?.data || {},
      database_info: {
        total_rules: user.availability_rules.length,
        has_user_state: !!user.user_state
      }
    };
  }

  private timeToMinutes(timeStr: string): number | null {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
} 
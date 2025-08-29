import { Controller, Get, Patch, Body, UseGuards, Request, HttpException, HttpStatus, Param, Post, Delete, Query } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma.service';

@Controller('availability')
export class AvailabilityController {
  constructor(
    private availabilityService: AvailabilityService,
    private prisma: PrismaService
  ) {}

  @Get('rules')
  @UseGuards(JwtAuthGuard)
  async getRules(@Request() req) {
    try {
      return await this.availabilityService.getAvailabilityRules(req.user.userId);
    } catch (error) {
      throw new HttpException('Failed to get availability rules', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('rules/:displayName')
  async getRulesByDisplayName(@Param('displayName') displayName: string) {
    try {
      // First, find the user by display name
      const user = await this.prisma.user.findFirst({
        where: { display_name: displayName }
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Then get their availability rules
      return await this.availabilityService.getAvailabilityRules(user.id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get availability rules', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('overrides')
  @UseGuards(JwtAuthGuard)
  async getOverrides(@Request() req, @Query('start') startDate: string, @Query('end') endDate: string) {
    try {
      console.log('[OVERRIDE DEBUG] GET /overrides called:', {
        userId: req.user.userId,
        startDate,
        endDate
      });

      if (!startDate || !endDate) {
        throw new HttpException('start and end dates are required', HttpStatus.BAD_REQUEST);
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new HttpException('Invalid date format', HttpStatus.BAD_REQUEST);
      }

      console.log('[OVERRIDE DEBUG] Parsed dates:', {
        start: start.toISOString(),
        end: end.toISOString()
      });

      const overrides = await this.availabilityService.getAvailabilityOverrides(req.user.userId, start, end);
      console.log('[OVERRIDE DEBUG] Returning overrides:', overrides);
      return overrides;
    } catch (error) {
      console.log('[OVERRIDE DEBUG] Error fetching overrides:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to get overrides', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('rules')
  @UseGuards(JwtAuthGuard)
  async updateRules(@Request() req, @Body() body: { rules: any[] }) {
    try {
      if (!body.rules || !Array.isArray(body.rules)) {
        throw new HttpException('Rules array is required', HttpStatus.BAD_REQUEST);
      }

      // Validate rules format
      const validRules = body.rules.map((rule, index) => {
        const dayOfWeek = parseInt(rule.day_of_week);
        const startMinute = parseInt(rule.start_minute);
        const endMinute = parseInt(rule.end_minute);

        // Validate that all values are valid numbers
        if (isNaN(dayOfWeek) || isNaN(startMinute) || isNaN(endMinute)) {
          throw new HttpException(
            `Invalid numeric values in rule at index ${index}`,
            HttpStatus.BAD_REQUEST
          );
        }

        // Validate ranges
        if (dayOfWeek < 0 || dayOfWeek > 6) {
          throw new HttpException(
            `Invalid day of week (${dayOfWeek}) in rule at index ${index}. Must be 0-6.`,
            HttpStatus.BAD_REQUEST
          );
        }

        if (startMinute < 0 || startMinute >= 1440) {
          throw new HttpException(
            `Invalid start minute (${startMinute}) in rule at index ${index}. Must be 0-1439.`,
            HttpStatus.BAD_REQUEST
          );
        }

        if (endMinute < 0 || endMinute >= 1440) {
          throw new HttpException(
            `Invalid end minute (${endMinute}) in rule at index ${index}. Must be 0-1439.`,
            HttpStatus.BAD_REQUEST
          );
        }

        if (startMinute >= endMinute) {
          throw new HttpException(
            `Start minute (${startMinute}) must be less than end minute (${endMinute}) in rule at index ${index}.`,
            HttpStatus.BAD_REQUEST
          );
        }

        return {
          dayOfWeek,
          startMinute,
          endMinute
        };
      });

      await this.availabilityService.updateAvailabilityRules(req.user.userId, validRules);
      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to update availability rules', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('overrides')
  @UseGuards(JwtAuthGuard)
  async upsertOverride(@Request() req, @Body() body: { date: string; available: boolean; start?: string; end?: string }) {
    try {
      console.log('[OVERRIDE DEBUG] POST /overrides called:', {
        userId: req.user.userId,
        body
      });

      if (!body?.date || typeof body.available !== 'boolean') {
        throw new HttpException('date and available are required', HttpStatus.BAD_REQUEST);
      }
      // Expect YYYY-MM-DD from UI; create Date at UTC midnight for that date
      const [year, month, day] = body.date.split('-').map(n => parseInt(n));
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new HttpException('Invalid date format', HttpStatus.BAD_REQUEST);
      }
      const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      if (isNaN(date.getTime())) {
        throw new HttpException('Invalid date', HttpStatus.BAD_REQUEST);
      }

      console.log('[OVERRIDE DEBUG] Parsed date:', {
        inputDate: body.date,
        parsedDate: date.toISOString()
      });

      // Convert optional HH:MM (local) to UTC minutes
      let startUtcMinute: number | undefined = undefined;
      let endUtcMinute: number | undefined = undefined;
      const toUtcMinutes = (hhmm: string) => {
        const [h, m] = hhmm.split(':').map(n => parseInt(n));
        if (isNaN(h) || isNaN(m)) return undefined;
        
        // Parse the date components from the input date string
        const [year, month, day] = body.date.split('-').map(n => parseInt(n));
        
        // Create a local datetime for the target date and time
        const localDateTime = new Date(year, month - 1, day, h, m, 0, 0);
        
        // Convert to UTC minutes from UTC midnight of that date
        const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const utcMinutes = Math.floor((localDateTime.getTime() - utcMidnight.getTime()) / 60000);
        
        return utcMinutes;
      };
      if (body.start) startUtcMinute = toUtcMinutes(body.start);
      if (body.end) endUtcMinute = toUtcMinutes(body.end);

      console.log('[OVERRIDE DEBUG] Time conversion:', {
        start: body.start,
        end: body.end,
        startUtcMinute,
        endUtcMinute,
        date: date.toISOString(),
        localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      await this.availabilityService.upsertAvailabilityOverride(req.user.userId, date, body.available, startUtcMinute, endUtcMinute);
      console.log('[OVERRIDE DEBUG] Override saved successfully');
      return { success: true };
    } catch (error) {
      console.log('[OVERRIDE DEBUG] Error saving override:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to upsert override', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('overrides/:date')
  @UseGuards(JwtAuthGuard)
  async deleteOverride(@Request() req, @Param('date') dateStr: string) {
    try {
      console.log('[OVERRIDE DEBUG] DELETE /overrides/:date called:', {
        userId: req.user.userId,
        dateStr
      });

      const [year, month, day] = dateStr.split('-').map(n => parseInt(n));
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new HttpException('Invalid date format', HttpStatus.BAD_REQUEST);
      }
      const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      if (isNaN(date.getTime())) {
        throw new HttpException('Invalid date', HttpStatus.BAD_REQUEST);
      }

      console.log('[OVERRIDE DEBUG] Parsed date for deletion:', {
        inputDate: dateStr,
        parsedDate: date.toISOString()
      });

      await this.availabilityService.deleteAvailabilityOverride(req.user.userId, date);
      console.log('[OVERRIDE DEBUG] Override deleted successfully');
      return { success: true };
    } catch (error) {
      console.log('[OVERRIDE DEBUG] Error deleting override:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to delete override', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

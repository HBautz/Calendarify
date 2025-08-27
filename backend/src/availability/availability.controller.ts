import { Controller, Get, Patch, Body, UseGuards, Request, HttpException, HttpStatus, Param } from '@nestjs/common';
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
}

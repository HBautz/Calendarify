import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpException, HttpStatus, Request } from '@nestjs/common';
import { EventTypesService } from './event-types.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('event-types')
export class EventTypesController {
  constructor(private eventTypesService: EventTypesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Request() req) {
    try {
      return await this.eventTypesService.list(req.user.userId);
    } catch (error) {
      throw new HttpException('Failed to list event types', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req, @Body() data: any) {
    try {
      return await this.eventTypesService.create(req.user.userId, data);
    } catch (error) {
      throw new HttpException('Failed to create event type', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    try {
      const eventType = await this.eventTypesService.findBySlug(slug);
      if (!eventType) {
        throw new HttpException('Event type not found', HttpStatus.NOT_FOUND);
      }
      return eventType;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to find event type', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    try {
      const eventType = await this.eventTypesService.findOne(id);
      if (!eventType) {
        throw new HttpException('Event type not found', HttpStatus.NOT_FOUND);
      }
      return eventType;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to find event type', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Request() req, @Param('id') id: string, @Body() data: any) {
    try {
      return await this.eventTypesService.update(id, data, req.user.userId);
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new HttpException('Event type not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to update event type', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    try {
      await this.eventTypesService.remove(id);
      return { success: true };
    } catch (error) {
      throw new HttpException('Failed to delete event type', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':slug/slots')
  async getAvailableSlots(
    @Param('slug') slug: string,
    @Query('date') dateStr: string,
    @Query('exclude') excludeBookingId?: string
  ) {
    try {
      // If no date provided, return event type details
      if (!dateStr) {
        const eventType = await this.eventTypesService.findBySlug(slug);
        if (!eventType) {
          throw new HttpException('Event type not found', HttpStatus.NOT_FOUND);
        }
        return eventType;
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new HttpException('Invalid date format', HttpStatus.BAD_REQUEST);
      }

      return await this.eventTypesService.getAvailableSlots(slug, date, excludeBookingId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.message?.includes('not found')) {
        throw new HttpException('Event type not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to get available slots', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':slug/book')
  async createBooking(@Param('slug') slug: string, @Body() data: any) {
    try {
      if (!data.name || !data.email || !data.start || !data.end) {
        throw new HttpException('Missing required booking fields', HttpStatus.BAD_REQUEST);
      }

      // Pass excludeBookingId if provided (for updating existing bookings)
      const bookingData = {
        name: data.name,
        email: data.email,
        start: data.start,
        end: data.end,
        questions: data.questions,
        excludeBookingId: data.excludeBookingId
      };

      return await this.eventTypesService.createBooking(slug, bookingData);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.message?.includes('not found')) {
        throw new HttpException('Event type not found', HttpStatus.NOT_FOUND);
      }
      if (error.message?.includes('not available')) {
        throw new HttpException('Selected time slot is not available', HttpStatus.CONFLICT);
      }
      throw new HttpException('Failed to create booking', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventTypesService } from './event-types.service';

@Controller('event-types')
export class EventTypesController {
  constructor(private events: EventTypesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req, @Body() body: any) {
    return this.events.create(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req) {
    return this.events.list(req.user.userId);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.events.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.events.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.events.update(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.events.remove(id);
  }

  @Get(':slug/slots')
  slots(@Param('slug') slug: string, @Query() query: any) {
    return { slug, query };
  }

  @Post(':slug/bookings')
  book(@Param('slug') slug: string, @Body() body: any) {
    return { slug, data: body };
  }
}

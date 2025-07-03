import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

@Controller('event-types')
export class EventTypesController {
  @Post()
  create(@Body() body: any) {
    return { message: 'create event type stub', data: body };
  }

  @Get()
  findAll() {
    return [];
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return { id, data: body };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return { id };
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

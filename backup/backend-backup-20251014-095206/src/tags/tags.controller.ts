import { Body, Controller, Delete, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TagsService } from './tags.service';

@Controller('tags')
export class TagsController {
  constructor(private tags: TagsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Request() req) {
    return this.tags.list(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req, @Body() body: { name: string }) {
    return this.tags.create(req.user.userId, body.name);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Request() req, @Param('id') id: string) {
    return this.tags.delete(req.user.userId, id);
  }
} 
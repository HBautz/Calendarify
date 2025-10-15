import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactsService } from './contacts.service';

@Controller('contacts')
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Request() req) {
    return this.contacts.list(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req, @Body() body: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    notes?: string;
    favorite?: boolean;
    tags?: string[];
  }) {
    return this.contacts.create(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.contacts.findById(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.contacts.update(id, req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Request() req, @Param('id') id: string) {
    return this.contacts.delete(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/tags')
  addTag(@Request() req, @Param('id') id: string, @Body() body: { tagName: string }) {
    return this.contacts.addTagToContact(id, req.user.userId, body.tagName);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/tags/:tagName')
  removeTag(@Request() req, @Param('id') id: string, @Param('tagName') tagName: string) {
    return this.contacts.removeTagFromContact(id, req.user.userId, tagName);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkflowsService } from './workflows.service';

@Controller('workflows')
export class WorkflowsController {
  constructor(private workflows: WorkflowsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Request() req) {
    return this.workflows.list(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.workflows.findById(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Request() req,
    @Body() body: { name: string; description?: string; data?: any },
  ) {
    return this.workflows.create(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Request() req, @Param('id') id: string) {
    return this.workflows.remove(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.workflows.update(req.user.userId, id, body);
  }
}

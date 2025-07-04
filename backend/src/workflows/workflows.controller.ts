import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
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
  @Post()
  create(@Request() req, @Body() body: { name: string; description?: string }) {
    return this.workflows.create(req.user.userId, body);
  }
}

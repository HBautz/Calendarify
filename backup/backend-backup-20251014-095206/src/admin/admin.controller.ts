import { Controller, Post, Get } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('status')
  async getStatus() {
    return this.adminService.getDatabaseStatus();
  }

  @Post('wipe')
  async wipeDatabase() {
    return this.adminService.wipeDatabase();
  }
} 
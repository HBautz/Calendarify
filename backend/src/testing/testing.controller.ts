import { Body, Controller, Get, Post, Request, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestingService } from './testing.service';

@Controller('testing')
export class TestingController {
  constructor(private testingService: TestingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('availability')
  getAvailability(@Request() req) {
    return this.testingService.getAvailability(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('availability')
  updateAvailability(@Request() req, @Body() body: any) {
    return this.testingService.updateAvailability(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user-state')
  getUserState(@Request() req) {
    return this.testingService.getUserState(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('user-state')
  updateUserState(@Request() req, @Body() body: any) {
    return this.testingService.updateUserState(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('timezone-test')
  testTimezone(@Request() req, @Body() body: any) {
    return this.testingService.testTimezone(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('debug-info')
  getDebugInfo(@Request() req) {
    return this.testingService.getDebugInfo(req.user.userId);
  }
} 
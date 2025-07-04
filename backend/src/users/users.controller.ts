import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UserStateService } from './user-state.service';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService, private state: UserStateService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req) {
    return this.users.findById(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  update(@Request() req, @Body() body: any) {
    return this.users.update(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/state')
  getState(@Request() req) {
    return this.state.load(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/state')
  saveState(@Request() req, @Body() body: any) {
    return this.state.save(req.user.userId, body);
  }
}

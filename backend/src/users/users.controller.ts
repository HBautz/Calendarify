import { Body, Controller, Get, Patch, Request, UseGuards, Param } from '@nestjs/common';
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

  @Get('display/:name')
  byDisplayName(@Param('name') name: string) {
    console.log('[TEMP-DEBUG] GET /users/display/' + name);
    return this.users.findByDisplayName(name);
  }

  @Get('display/:name/state')
  stateByDisplay(@Param('name') name: string) {
    console.log('[TEMP-DEBUG] GET /users/display/' + name + '/state');
    return this.state.loadByDisplayName(name);
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

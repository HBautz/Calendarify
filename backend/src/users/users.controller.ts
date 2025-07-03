import { Body, Controller, Get, Patch } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get('me')
  me() {
    return { user: null };
  }

  @Patch('me')
  update(@Body() body: any) {
    return { message: 'update stub', data: body };
  }
}

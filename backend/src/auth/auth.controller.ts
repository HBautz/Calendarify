import { Body, Controller, Post } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('register')
  register(@Body() body: any) {
    return { message: 'register stub', data: body };
  }

  @Post('login')
  login(@Body() body: any) {
    return { message: 'login stub', data: body };
  }

  @Post('logout')
  logout() {
    return { message: 'logout stub' };
  }
}

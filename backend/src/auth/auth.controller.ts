import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    const token = result?.access_token;
    if (token) {
      const isProd = (process.env.NODE_ENV === 'production');
      // In dev, enable cross-site cookie for localhost:3000 -> 3001 with SameSite=None
      res.cookie('access_token', token, {
        httpOnly: true,
        secure: isProd ? true : false,
        sameSite: isProd ? 'lax' : 'none',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
    }
    return { ok: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    return { ok: true };
  }
}

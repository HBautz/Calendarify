import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    // Create the user, then immediately log them in and set cookie
    const result = await this.auth.register(dto);
    // Auto-login: reuse login logic to issue cookie
    const login = await this.auth.login({ email: dto.email, password: dto.password } as any);
    const token = login?.access_token;
    if (token) {
      const isProd = (process.env.NODE_ENV === 'production');
      const oneWeek = 1000 * 60 * 60 * 24 * 7;
      res.cookie('access_token', token, {
        httpOnly: true,
        secure: isProd ? true : false,
        // In dev, prefer lax to avoid SameSite=None+Secure limitations on http
        sameSite: isProd ? 'lax' : 'lax',
        maxAge: oneWeek,
        path: '/',
      });
    }
    return { access_token: token };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    const token = result?.access_token;
    if (token) {
      const isProd = (process.env.NODE_ENV === 'production');
      res.cookie('access_token', token, {
        httpOnly: true,
        secure: isProd ? true : false,
        sameSite: isProd ? 'lax' : 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
    }
    return { access_token: token };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    return { ok: true };
  }
}

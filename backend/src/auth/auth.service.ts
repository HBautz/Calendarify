import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { generateUniqueUserSlug } from '../event-types/slug.utils';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(data: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }
    const password = await bcrypt.hash(data.password, 10);
    const displaySource = data.displayName || data.name || data.email;
    const display = await generateUniqueUserSlug(this.prisma, displaySource);
    const user = await this.prisma.user.create({ data: { email: data.email, password, name: data.name, display_name: display } });
    return { id: user.id, email: user.email, name: user.name, display_name: user.display_name };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.password);
    if (valid) return user;
    return null;
  }

  async login(data: LoginDto) {
    const user = await this.validateUser(data.email, data.password);
    if (!user) throw new UnauthorizedException();
    const payload = { sub: user.id };
    return {
      access_token: await this.jwt.signAsync(payload),
    };
  }
}

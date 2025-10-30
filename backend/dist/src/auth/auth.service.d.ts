import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private prisma;
    private jwt;
    constructor(prisma: PrismaService, jwt: JwtService);
    register(data: RegisterDto): Promise<{
        id: string;
        email: string;
        name: string | null;
        display_name: string | null;
    }>;
    validateUser(email: string, password: string): Promise<{
        id: string;
        name: string | null;
        created_at: Date;
        updated_at: Date;
        email: string;
        display_name: string | null;
        password: string;
    } | null>;
    login(data: LoginDto): Promise<{
        access_token: string;
    }>;
}

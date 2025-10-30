import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    register(dto: RegisterDto, res: Response): Promise<{
        access_token: string;
    }>;
    login(dto: LoginDto, res: Response): Promise<{
        access_token: string;
    }>;
    logout(res: Response): {
        ok: boolean;
    };
}

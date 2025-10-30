import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    register(dto: RegisterDto): Promise<{
        id: string;
        email: string;
        name: string | null;
        display_name: string | null;
    }>;
    login(dto: LoginDto): Promise<{
        access_token: string;
    }>;
    logout(): {
        message: string;
    };
}

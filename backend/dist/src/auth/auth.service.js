"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma.service");
const bcrypt = require("bcrypt");
const slug_utils_1 = require("../event-types/slug.utils");
let AuthService = class AuthService {
    prisma;
    jwt;
    constructor(prisma, jwt) {
        this.prisma = prisma;
        this.jwt = jwt;
    }
    async register(data) {
        const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            const { ConflictException } = await Promise.resolve().then(() => require('@nestjs/common'));
            throw new ConflictException('Email already registered');
        }
        const password = await bcrypt.hash(data.password, 10);
        const displaySource = data.displayName || data.name || data.email;
        const display = await (0, slug_utils_1.generateUniqueUserSlug)(this.prisma, displaySource);
        const user = await this.prisma.user.create({ data: { email: data.email, password, name: data.name, display_name: display } });
        return { id: user.id, email: user.email, name: user.name, display_name: user.display_name };
    }
    async validateUser(email, password) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user)
            return null;
        const valid = await bcrypt.compare(password, user.password);
        if (valid)
            return user;
        return null;
    }
    async login(data) {
        const user = await this.validateUser(data.email, data.password);
        if (!user)
            throw new common_1.UnauthorizedException();
        const payload = { sub: user.id };
        return {
            access_token: await this.jwt.signAsync(payload),
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
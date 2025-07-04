import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserStateService {
  constructor(private prisma: PrismaService) {}

  async load(userId: string): Promise<any> {
    const state = await this.prisma.userState.findUnique({
      where: { user_id: userId },
    });
    return state?.data || {};
  }

  async save(userId: string, data: any) {
    await this.prisma.userState.upsert({
      where: { user_id: userId },
      update: { data },
      create: { user_id: userId, data },
    });
  }
}

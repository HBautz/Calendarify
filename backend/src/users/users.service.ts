import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { generateUniqueUserSlug } from '../event-types/slug.utils';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByDisplayName(displayName: string) {
    return this.prisma.user.findUnique({ where: { display_name: displayName } });
  }

  async update(id: string, data: any) {
    if (data.displayName) {
      data.display_name = await generateUniqueUserSlug(this.prisma, data.displayName, id);
      delete data.displayName;
    }
    return this.prisma.user.update({ where: { id }, data });
  }
}

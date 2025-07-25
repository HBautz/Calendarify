import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { generateUniqueSlug } from './slug.utils';

export interface EventType {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description?: string;
  duration: number;
}

@Injectable()
export class EventTypesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.eventType.findMany({ where: { user_id: userId }, orderBy: { created_at: 'asc' } });
  }

  async create(userId: string, data: Omit<EventType, 'id' | 'userId'>) {
    const slug = await generateUniqueSlug(this.prisma, data.slug || data.title);
    return this.prisma.eventType.create({
      data: { user_id: userId, ...data, slug },
    });
  }

  findOne(id: string) {
    return this.prisma.eventType.findUnique({ where: { id } });
  }

  findBySlug(slug: string) {
    return this.prisma.eventType.findUnique({ where: { slug } });
  }

  async update(id: string, data: Partial<EventType>) {
    if (data.title || data.slug) {
      const source = data.slug || data.title!;
      data.slug = await generateUniqueSlug(this.prisma, source, id);
    }
    return this.prisma.eventType.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.eventType.delete({ where: { id } });
  }
}

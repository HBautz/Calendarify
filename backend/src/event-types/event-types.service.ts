import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

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

  create(userId: string, data: Omit<EventType, 'id' | 'userId'>) {
    return this.prisma.eventType.create({
      data: { user_id: userId, ...data },
    });
  }

  findOne(id: string) {
    return this.prisma.eventType.findUnique({ where: { id } });
  }

  findBySlug(slug: string) {
    return this.prisma.eventType.findUnique({ where: { slug } });
  }

  update(id: string, data: Partial<EventType>) {
    return this.prisma.eventType.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.eventType.delete({ where: { id } });
  }
}

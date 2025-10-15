import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface Tag {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string): Promise<Tag[]> {
    const tags = await this.prisma.tag.findMany({
      where: { user_id: userId },
      orderBy: { name: 'asc' }
    });
    return tags.map(tag => ({
      id: tag.id,
      userId: tag.user_id,
      name: tag.name,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    }));
  }

  async create(userId: string, name: string): Promise<Tag> {
    const tag = await this.prisma.tag.create({
      data: {
        user_id: userId,
        name: name.trim()
      }
    });
    return {
      id: tag.id,
      userId: tag.user_id,
      name: tag.name,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    };
  }

  async delete(userId: string, tagId: string): Promise<void> {
    await this.prisma.tag.deleteMany({
      where: {
        id: tagId,
        user_id: userId
      }
    });
  }

  async findByName(userId: string, name: string): Promise<Tag | null> {
    const tag = await this.prisma.tag.findFirst({
      where: {
        user_id: userId,
        name: name.trim()
      }
    });
    if (!tag) return null;
    return {
      id: tag.id,
      userId: tag.user_id,
      name: tag.name,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    };
  }
} 
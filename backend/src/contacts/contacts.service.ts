import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface Contact {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  favorite: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string): Promise<Contact[]> {
    const contacts = await this.prisma.contact.findMany({
      where: { user_id: userId },
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return contacts.map(contact => ({
      id: contact.id,
      userId: contact.user_id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone || undefined,
      company: contact.company || undefined,
      notes: contact.notes || undefined,
      favorite: contact.favorite,
      tags: contact.tags.map(ct => ct.tag.name),
      createdAt: contact.created_at,
      updatedAt: contact.updated_at
    }));
  }

  async create(userId: string, data: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    notes?: string;
    favorite?: boolean;
    tags?: string[];
  }): Promise<Contact> {
    const { tags, ...contactData } = data;
    
    const contact = await this.prisma.contact.create({
      data: {
        user_id: userId,
        ...contactData,
        favorite: contactData.favorite || false
      },
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    // Add tags if provided
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        await this.addTagToContact(contact.id, userId, tagName);
      }
    }

    return {
      id: contact.id,
      userId: contact.user_id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone || undefined,
      company: contact.company || undefined,
      notes: contact.notes || undefined,
      favorite: contact.favorite,
      tags: contact.tags.map(ct => ct.tag.name),
      createdAt: contact.created_at,
      updatedAt: contact.updated_at
    };
  }

  async addTagToContact(contactId: string, userId: string, tagName: string): Promise<void> {
    // Find or create the tag
    let tag = await this.prisma.tag.findFirst({
      where: {
        user_id: userId,
        name: tagName.trim()
      }
    });

    if (!tag) {
      tag = await this.prisma.tag.create({
        data: {
          user_id: userId,
          name: tagName.trim()
        }
      });
    }

    // Check if contact-tag relationship already exists
    const existingRelation = await this.prisma.contactTag.findFirst({
      where: {
        contact_id: contactId,
        tag_id: tag.id
      }
    });

    if (!existingRelation) {
      await this.prisma.contactTag.create({
        data: {
          contact_id: contactId,
          tag_id: tag.id
        }
      });
    }
  }

  async removeTagFromContact(contactId: string, userId: string, tagName: string): Promise<void> {
    const tag = await this.prisma.tag.findFirst({
      where: {
        user_id: userId,
        name: tagName.trim()
      }
    });

    if (tag) {
      await this.prisma.contactTag.deleteMany({
        where: {
          contact_id: contactId,
          tag_id: tag.id
        }
      });
    }
  }

  async update(contactId: string, userId: string, data: Partial<Contact>): Promise<Contact> {
    const { tags, ...updateData } = data;
    
    await this.prisma.contact.updateMany({
      where: {
        id: contactId,
        user_id: userId
      },
      data: updateData
    });

    // Update tags if provided
    if (tags !== undefined) {
      // Remove all existing tags
      await this.prisma.contactTag.deleteMany({
        where: {
          contact_id: contactId
        }
      });

      // Add new tags
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          await this.addTagToContact(contactId, userId, tagName);
        }
      }
    }

    // Always returns a Contact (throws if not found)
    const updated = await this.findById(contactId, userId);
    if (!updated) throw new Error('Contact not found after update');
    return updated;
  }

  async findById(contactId: string, userId: string): Promise<Contact | null> {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        user_id: userId
      },
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    if (!contact) return null;

    return {
      id: contact.id,
      userId: contact.user_id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone || undefined,
      company: contact.company || undefined,
      notes: contact.notes || undefined,
      favorite: contact.favorite,
      tags: contact.tags.map(ct => ct.tag.name),
      createdAt: contact.created_at,
      updatedAt: contact.updated_at
    };
  }

  async delete(contactId: string, userId: string): Promise<void> {
    await this.prisma.contact.deleteMany({
      where: {
        id: contactId,
        user_id: userId
      }
    });
  }
}

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface Contact {
  id: string;
  userId: string;
  name: string;
  email: string;
}

@Injectable()
export class ContactsService {
  private contacts: Contact[] = [];

  list(userId: string) {
    return this.contacts.filter(c => c.userId === userId);
  }

  create(userId: string, data: Pick<Contact, 'name' | 'email'>) {
    const contact = { id: randomUUID(), userId, ...data };
    this.contacts.push(contact);
    return contact;
  }
}

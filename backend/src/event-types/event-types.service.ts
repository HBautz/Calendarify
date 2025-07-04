import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

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
  private eventTypes: EventType[] = [];

  list(userId: string) {
    return this.eventTypes.filter(e => e.userId === userId);
  }

  create(userId: string, data: Omit<EventType, 'id' | 'userId'>) {
    const event = { id: randomUUID(), userId, ...data };
    this.eventTypes.push(event);
    return event;
  }

  findOne(id: string) {
    return this.eventTypes.find(e => e.id === id);
  }

  update(id: string, data: Partial<EventType>) {
    const idx = this.eventTypes.findIndex(e => e.id === id);
    if (idx >= 0) this.eventTypes[idx] = { ...this.eventTypes[idx], ...data };
    return this.eventTypes[idx];
  }

  remove(id: string) {
    this.eventTypes = this.eventTypes.filter(e => e.id !== id);
    return { id };
  }
}

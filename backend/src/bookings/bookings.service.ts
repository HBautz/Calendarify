import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface CreateBookingDto {
  event_type_id: string;
  user_id: string;
  name: string;
  email: string;
  starts_at: Date;
  ends_at: Date;
}

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateBookingDto) {
    return this.prisma.booking.create({ data });
  }

  findForUser(userId: string) {
    return this.prisma.booking.findMany({
      where: { user_id: userId },
      include: { event_type: true },
      orderBy: { starts_at: 'asc' },
    });
  }

  remove(id: string) {
    return this.prisma.booking.delete({ where: { id } });
  }
}

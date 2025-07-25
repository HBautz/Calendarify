import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventTypesModule } from './event-types/event-types.module';
import { BookingsModule } from './bookings/bookings.module';
import { AvailabilityModule } from './availability/availability.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { ContactsModule } from './contacts/contacts.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { TagsModule } from './tags/tags.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    EventTypesModule,
    BookingsModule,
    AvailabilityModule,
    IntegrationsModule,
    ContactsModule,
    WorkflowsModule,
    TagsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}

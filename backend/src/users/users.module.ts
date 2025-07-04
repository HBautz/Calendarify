import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { UserStateService } from './user-state.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService, UserStateService],
  exports: [UsersService, UserStateService],
})
export class UsersModule {}

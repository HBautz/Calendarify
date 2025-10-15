import { Module } from '@nestjs/common';
import { TestingController } from './testing.controller';
import { TestingService } from './testing.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [TestingController],
  providers: [TestingService, PrismaService],
})
export class TestingModule {} 
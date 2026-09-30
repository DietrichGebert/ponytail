import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly startupLogger = new Logger(PrismaService.name);
  async onModuleInit() {
    try {
      await this.$connect();
    } catch {
      this.startupLogger.warn(
        'Database connection unavailable. Data routes remain unavailable until connectivity is restored; check readiness before serving traffic.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

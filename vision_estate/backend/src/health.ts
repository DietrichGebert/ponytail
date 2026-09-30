import {
  Controller,
  Get,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApplicationRepository } from './application.repository';
@Injectable()
export class HealthService {
  constructor(private repository: ApplicationRepository) {}
  async ready() {
    try {
      await this.repository.ping();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
@Controller('v1/health')
export class HealthController {
  constructor(private service: HealthService) {}
  @Get('live') live() {
    return { status: 'ok' };
  }
  @Get('ready') async ready() {
    return this.service.ready();
  }
}

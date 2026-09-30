import { Module } from '@nestjs/common';
import { ApplicationRepository } from '../application.repository';
import { PrismaService } from '../prisma.service';
import { LeadQueryRepository } from './lead-query.repository';
import { LeadQueryService } from './lead-query.service';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertyWorkflowService } from './property-workflow-service';
import { ValuationAiService } from './valuation-ai.service';

@Module({
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    ValuationAiService,
    PrismaService,
    ApplicationRepository,
    PropertyWorkflowService,
    LeadQueryService,
    LeadQueryRepository,
  ],
  exports: [PropertiesService, ValuationAiService],
})
export class PropertiesModule {}

import { Module } from '@nestjs/common';
import { RecordsController, RecordsService, PropertyRecordsController } from './records';
import { StaffInvitationsController, StaffInvitationsService } from './staff-invitations';
import { FullReportWorker } from './full-report-worker';
import { NewsletterController, NewsletterService } from './newsletter';
import { AdminService } from './admin-service';
import { ApplicationRepository } from './application.repository';
import { AdminGuard, AuthController, AuthGuard, OptionalStaffGuard } from './auth';
import { AuthService } from './auth-service';
import { BookingService } from './booking-service';
import { DeliveryWorker } from './delivery-worker';
import { HealthController, HealthService } from './health';
import { AdminController, BookingController } from './operations';
import { PrismaService } from './prisma.service';
import { LeadQueryRepository } from './properties/lead-query.repository';
import { LeadQueryService } from './properties/lead-query.service';
import { PropertiesController } from './properties/properties.controller';
import { PropertiesService } from './properties/properties.service';
import { PropertyWorkflowService } from './properties/property-workflow-service';
import { ValuationAiService } from './properties/valuation-ai.service';
@Module({
  controllers: [
    RecordsController,
    PropertyRecordsController,
    StaffInvitationsController,
    NewsletterController,
    PropertiesController,
    AuthController,
    AdminController,
    BookingController,
    HealthController,
  ],
  providers: [
    RecordsService,
    StaffInvitationsService,
    FullReportWorker,
    NewsletterService,
    PrismaService,
    HealthService,
    ApplicationRepository,
    AuthService,
    AdminService,
    BookingService,
    PropertyWorkflowService,
    LeadQueryService,
    LeadQueryRepository,
    PropertiesService,
    ValuationAiService,
    AuthGuard,
    OptionalStaffGuard,
    AdminGuard,
    DeliveryWorker,
  ],
})
export class AppModule {}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Typed persistence operations and transaction boundary. No HTTP or business decisions. */
@Injectable()
export class ApplicationRepository {
  constructor(private database: PrismaService) {}
  ping() {
    return this.database.$queryRaw`SELECT 1`;
  }
  get createStaffInvitation() {
    return this.database.staffInvitation.create.bind(
      this.database.staffInvitation,
    ) as typeof this.database.staffInvitation.create;
  }
  get findUniqueStaffInvitation() {
    return this.database.staffInvitation.findUnique.bind(
      this.database.staffInvitation,
    ) as typeof this.database.staffInvitation.findUnique;
  }
  get updateManyStaffInvitation() {
    return this.database.staffInvitation.updateMany.bind(
      this.database.staffInvitation,
    ) as typeof this.database.staffInvitation.updateMany;
  }
  lockSessionFamily(familyId: string) {
    return this.database
      .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${familyId}, 0))::text`;
  }
  lockLead(id: string) {
    return this.database
      .$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
  }
  lockStaffUser(id: string) {
    return this.database
      .$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
  }
  get upsertNewsletterSubscription() {
    return this.database.newsletterSubscription.upsert.bind(
      this.database.newsletterSubscription,
    ) as typeof this.database.newsletterSubscription.upsert;
  }
  get findUniqueNewsletterSubscription() {
    return this.database.newsletterSubscription.findUnique.bind(
      this.database.newsletterSubscription,
    ) as typeof this.database.newsletterSubscription.findUnique;
  }
  get updateManyNewsletterSubscription() {
    return this.database.newsletterSubscription.updateMany.bind(
      this.database.newsletterSubscription,
    ) as typeof this.database.newsletterSubscription.updateMany;
  }
  get findUniqueNotification() {
    return this.database.notification.findUnique.bind(
      this.database.notification,
    ) as typeof this.database.notification.findUnique;
  }
  get findManyUser() {
    return this.database.user.findMany.bind(
      this.database.user,
    ) as typeof this.database.user.findMany;
  }
  get countLead() {
    return this.database.lead.count.bind(
      this.database.lead,
    ) as typeof this.database.lead.count;
  }
  get countProperty() {
    return this.database.property.count.bind(
      this.database.property,
    ) as typeof this.database.property.count;
  }
  get groupByNotification() {
    return this.database.notification.groupBy.bind(
      this.database.notification,
    ) as typeof this.database.notification.groupBy;
  }
  get findManyAuditLog() {
    return this.database.auditLog.findMany.bind(
      this.database.auditLog,
    ) as typeof this.database.auditLog.findMany;
  }
  get createUser() {
    return this.database.user.create.bind(
      this.database.user,
    ) as typeof this.database.user.create;
  }
  get createAuditLog() {
    return this.database.auditLog.create.bind(
      this.database.auditLog,
    ) as typeof this.database.auditLog.create;
  }
  get updateUser() {
    return this.database.user.update.bind(
      this.database.user,
    ) as typeof this.database.user.update;
  }
  get deleteManySession() {
    return this.database.session.deleteMany.bind(
      this.database.session,
    ) as typeof this.database.session.deleteMany;
  }
  get findFirstUser() {
    return this.database.user.findFirst.bind(
      this.database.user,
    ) as typeof this.database.user.findFirst;
  }
  get updateLead() {
    return this.database.lead.update.bind(
      this.database.lead,
    ) as typeof this.database.lead.update;
  }
  get findManyBooking() {
    return this.database.booking.findMany.bind(
      this.database.booking,
    ) as typeof this.database.booking.findMany;
  }
  get findFirstAvailabilitySlot() {
    return this.database.availabilitySlot.findFirst.bind(
      this.database.availabilitySlot,
    ) as typeof this.database.availabilitySlot.findFirst;
  }
  get createAvailabilitySlot() {
    return this.database.availabilitySlot.create.bind(
      this.database.availabilitySlot,
    ) as typeof this.database.availabilitySlot.create;
  }
  get findUniqueLead() {
    return this.database.lead.findUnique.bind(
      this.database.lead,
    ) as typeof this.database.lead.findUnique;
  }
  get findManyAvailabilitySlot() {
    return this.database.availabilitySlot.findMany.bind(
      this.database.availabilitySlot,
    ) as typeof this.database.availabilitySlot.findMany;
  }
  get findUniqueAvailabilitySlot() {
    return this.database.availabilitySlot.findUnique.bind(
      this.database.availabilitySlot,
    ) as typeof this.database.availabilitySlot.findUnique;
  }
  get findFirstBooking() {
    return this.database.booking.findFirst.bind(
      this.database.booking,
    ) as typeof this.database.booking.findFirst;
  }
  get createBooking() {
    return this.database.booking.create.bind(
      this.database.booking,
    ) as typeof this.database.booking.create;
  }
  get updateBooking() {
    return this.database.booking.update.bind(
      this.database.booking,
    ) as typeof this.database.booking.update;
  }
  get findFirstReport() {
    return this.database.report.findFirst.bind(
      this.database.report,
    ) as typeof this.database.report.findFirst;
  }
  get findUniqueReport() {
    return this.database.report.findUnique.bind(
      this.database.report,
    ) as typeof this.database.report.findUnique;
  }
  get updateManyReport() {
    return this.database.report.updateMany.bind(
      this.database.report,
    ) as typeof this.database.report.updateMany;
  }
  get updateManyProperty() {
    return this.database.property.updateMany.bind(
      this.database.property,
    ) as typeof this.database.property.updateMany;
  }
  get findUniqueProperty() {
    return this.database.property.findUnique.bind(
      this.database.property,
    ) as typeof this.database.property.findUnique;
  }
  get createProperty() {
    return this.database.property.create.bind(
      this.database.property,
    ) as typeof this.database.property.create;
  }
  get createLead() {
    return this.database.lead.create.bind(
      this.database.lead,
    ) as typeof this.database.lead.create;
  }
  get createConsent() {
    return this.database.consent.create.bind(
      this.database.consent,
    ) as typeof this.database.consent.create;
  }
  get findManyConsent() {
    return this.database.consent.findMany.bind(
      this.database.consent,
    ) as typeof this.database.consent.findMany;
  }
  get createNotification() {
    return this.database.notification.create.bind(
      this.database.notification,
    ) as typeof this.database.notification.create;
  }
  get findManyProperty() {
    return this.database.property.findMany.bind(
      this.database.property,
    ) as typeof this.database.property.findMany;
  }
  get findUniqueOrThrowProperty() {
    return this.database.property.findUniqueOrThrow.bind(
      this.database.property,
    ) as typeof this.database.property.findUniqueOrThrow;
  }
  get createValuation() {
    return this.database.valuation.create.bind(
      this.database.valuation,
    ) as typeof this.database.valuation.create;
  }
  get findFirstValuation() {
    return this.database.valuation.findFirst.bind(
      this.database.valuation,
    ) as typeof this.database.valuation.findFirst;
  }
  get createReport() {
    return this.database.report.create.bind(
      this.database.report,
    ) as typeof this.database.report.create;
  }
  get updateProperty() {
    return this.database.property.update.bind(
      this.database.property,
    ) as typeof this.database.property.update;
  }
  get updateManyBooking() {
    return this.database.booking.updateMany.bind(
      this.database.booking,
    ) as typeof this.database.booking.updateMany;
  }
  get findManyNotification() {
    return this.database.notification.findMany.bind(
      this.database.notification,
    ) as typeof this.database.notification.findMany;
  }
  get updateNotification() {
    return this.database.notification.update.bind(
      this.database.notification,
    ) as typeof this.database.notification.update;
  }
  get updateManyNotification() {
    return this.database.notification.updateMany.bind(
      this.database.notification,
    ) as typeof this.database.notification.updateMany;
  }
  get findUniqueSession() {
    return this.database.session.findUnique.bind(
      this.database.session,
    ) as typeof this.database.session.findUnique;
  }
  get findUniqueUser() {
    return this.database.user.findUnique.bind(
      this.database.user,
    ) as typeof this.database.user.findUnique;
  }
  get createSession() {
    return this.database.session.create.bind(
      this.database.session,
    ) as typeof this.database.session.create;
  }
  get updateManySession() {
    return this.database.session.updateMany.bind(
      this.database.session,
    ) as typeof this.database.session.updateMany;
  }
  transaction<T>(
    work: (repository: ApplicationRepository) => Promise<T>,
    options?: {
      isolationLevel?: Prisma.TransactionIsolationLevel;
      timeout?: number;
      maxWait?: number;
    },
  ): Promise<T> {
    return this.database.$transaction(
      (tx) => work(new ApplicationRepository(tx as PrismaService)),
      options,
    );
  }
}

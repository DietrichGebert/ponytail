import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ApplicationRepository } from './application.repository';
import { integrationConfigured } from './integration-config';
import { invitationToken } from './staff-invitations';
import { NewsletterService, newsletterToken } from './newsletter';
import { hashToken } from './auth-crypto';
@Injectable()
export class DeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private logger = new Logger(DeliveryWorker.name);
  constructor(private repository: ApplicationRepository) {}
  onModuleInit() {
    if (process.env.WORKERS_ENABLED === 'true') {
      this.timer = setInterval(() => void this.tick(), 15000);
      this.timer.unref();
    }
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  private async send(
    url: string | undefined,
    key: string | undefined,
    id: string,
    body: unknown,
  ) {
    if (!url || !key || new URL(url).protocol !== 'https:')
      throw new Error('Integration unavailable');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
        'Idempotency-Key': id,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error('Integration unavailable');
    return res.json();
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await new NewsletterService(this.repository).expire();
      if (
        integrationConfigured(
          process.env.CALENDAR_GATEWAY_URL,
          process.env.CALENDAR_GATEWAY_KEY,
        )
      ) {
        const bookings = await this.repository.findManyBooking({
          where: { status: 'PENDING_CALENDAR' },
          include: { slot: true, property: true },
          take: 5,
        });
        for (const booking of bookings) {
          try {
            // The gateway must check the external calendar for conflicts and deduplicate by booking ID.
            const result = await this.send(
              process.env.CALENDAR_GATEWAY_URL,
              process.env.CALENDAR_GATEWAY_KEY,
              booking.id,
              {
                bookingId: booking.id,
                brokerId: booking.slot.brokerId,
                startsAt: booking.slot.startsAt,
                endsAt: booking.slot.endsAt,
              },
            );
            if (
              result.status !== 'CONFIRMED' ||
              typeof result.eventId !== 'string' ||
              !result.eventId
            )
              throw new Error('Calendar did not confirm');
            await this.repository.transaction(async (tx) => {
              const changed = await tx.updateManyBooking({
                where: { id: booking.id, status: 'PENDING_CALENDAR' },
                data: { status: 'CONFIRMED', calendarEventId: result.eventId },
              });
              if (!changed.count) return;
              await tx.updateLead({
                where: { propertyId: booking.propertyId },
                data: { stage: 'CONSULTATION_BOOKED' },
              });
              const contact = booking.property.sellerContact as {
                email: string;
              };
              await tx.createNotification({
                data: {
                  kind: 'BOOKING_CONFIRMED',
                  recipient: contact.email,
                  payload: {
                    bookingId: booking.id,
                    startsAt: booking.slot.startsAt.toISOString(),
                  },
                },
              });
              await tx.createAuditLog({
                data: {
                  actorId: 'calendar-worker',
                  action: 'BOOKING_CONFIRMED',
                  entityType: 'BOOKING',
                  entityId: booking.id,
                },
              });
            });
          } catch {
            await this.repository.updateManyBooking({
              where: { id: booking.id, status: 'PENDING_CALENDAR' },
              data: { status: 'CALENDAR_REVIEW_REQUIRED' },
            });
          }
        }
      }
      if (
        process.env.EMAIL_GATEWAY_URL ||
        process.env.NEWSLETTER_EMAIL_GATEWAY_URL
      ) {
        const newsletterReady = !!(
          process.env.NEWSLETTER_EMAIL_GATEWAY_URL &&
          process.env.NEWSLETTER_EMAIL_GATEWAY_KEY &&
          process.env.NEWSLETTER_TOKEN_SECRET &&
          process.env.PUBLIC_APP_URL
        );
        const jobs = await this.repository.findManyNotification({
          where: {
            state: 'PENDING',
            attempts: { lt: 5 },
            OR: [
              ...(newsletterReady
                ? [{ kind: { in: ['NEWSLETTER_CONFIRM', 'NEWSLETTER'] } }]
                : []),
              ...(process.env.EMAIL_GATEWAY_URL && process.env.EMAIL_GATEWAY_KEY
                ? [
                    {
                      kind: {
                        notIn: [
                          'FULL_REPORT_GENERATION',
                          'NEWSLETTER_CONFIRM',
                          'NEWSLETTER',
                        ],
                      },
                    },
                  ]
                : []),
            ],
          },
          take: 10,
          orderBy: { createdAt: 'asc' },
        });
        for (const job of jobs) {
          try {
            const newsletter =
              job.kind === 'NEWSLETTER_CONFIRM' || job.kind === 'NEWSLETTER';
            const gateway = newsletter
              ? process.env.NEWSLETTER_EMAIL_GATEWAY_URL
              : process.env.EMAIL_GATEWAY_URL;
            const gatewayKey = newsletter
              ? process.env.NEWSLETTER_EMAIL_GATEWAY_KEY
              : process.env.EMAIL_GATEWAY_KEY;
            // Missing configuration leaves jobs pending, without burning retry attempts.
            if (
              !gateway ||
              !gatewayKey ||
              (newsletter && !process.env.NEWSLETTER_TOKEN_SECRET)
            )
              continue;
            let payload = job.payload;
            if (job.kind === 'BROKER_INVITATION') {
              const p = job.payload as {
                invitationId: string;
                locale: string;
                expiresAt: string;
              };
              const invite = await this.repository.findUniqueStaffInvitation({
                where: { id: p.invitationId },
                include: { user: true },
              });
              if (
                !invite ||
                invite.acceptedAt ||
                invite.revokedAt ||
                invite.user.active ||
                invite.expiresAt.toISOString() !== p.expiresAt ||
                invite.expiresAt <= new Date() ||
                invite.user.email !== job.recipient
              ) {
                await this.repository.updateNotification({
                  where: { id: job.id },
                  data: { state: 'CANCELLED' },
                });
                continue;
              }
              const origin = process.env.PUBLIC_APP_URL;
              if (
                !origin ||
                new URL(origin).protocol !== 'https:' ||
                !process.env.AUTH_JWT_SECRET
              )
                continue;
              const token = invitationToken(
                invite.id,
                invite.expiresAt.getTime(),
              );
              if (hashToken(token) !== invite.tokenHash) {
                await this.repository.updateNotification({
                  where: { id: job.id },
                  data: { state: 'CANCELLED' },
                });
                continue;
              }
              payload = {
                locale: p.locale,
                invitationUrl: new URL(
                  '/broker/signup#token=' + token,
                  origin,
                ).toString(),
                subject:
                  p.locale === 'en'
                    ? 'Your Vision Estates broker invitation'
                    : 'Ihre Einladung zum Vision Estates Maklerportal',
                message:
                  p.locale === 'en'
                    ? 'Verify your email and set your own password. Your administrator-approved invitation expires in 48 hours.'
                    : 'Bestätigen Sie Ihre E-Mail-Adresse und legen Sie Ihr Passwort fest. Ihre Einladung ist 48 Stunden gültig.',
              };
            }
            if (job.kind === 'NEWSLETTER_CONFIRM') {
              const p = job.payload as {
                subscriptionId: string;
                locale: string;
                expiresAt: string;
              };
              const subscription =
                await this.repository.findUniqueNewsletterSubscription({
                  where: { id: p.subscriptionId },
                });
              if (
                !subscription ||
                subscription.state !== 'PENDING' ||
                !subscription.confirmTokenExpiresAt ||
                subscription.confirmTokenExpiresAt.toISOString() !==
                  p.expiresAt ||
                subscription.confirmTokenExpiresAt.getTime() <= Date.now()
              ) {
                await this.repository.updateNotification({
                  where: { id: job.id },
                  data: { state: 'CANCELLED' },
                });
                continue;
              }
              const origin = process.env.PUBLIC_APP_URL;
              if (!origin || new URL(origin).protocol !== 'https:') continue;
              const token = newsletterToken(
                subscription.id,
                'confirm',
                subscription.confirmTokenExpiresAt.getTime(),
              );
              const changed =
                await this.repository.updateManyNewsletterSubscription({
                  where: {
                    id: subscription.id,
                    state: 'PENDING',
                    confirmTokenExpiresAt: subscription.confirmTokenExpiresAt,
                  },
                  data: { confirmTokenHash: hashToken(token) },
                });
              if (!changed.count) continue;
              payload = {
                ...p,
                confirmUrl: new URL(
                  '/newsletter/confirm#token=' + token,
                  origin,
                ).toString(),
                subject:
                  p.locale === 'en'
                    ? 'Confirm your Vision Estates newsletter subscription'
                    : 'Bestätigen Sie Ihr Vision Estates Newsletter-Abonnement',
                message:
                  p.locale === 'en'
                    ? 'Confirm your subscription using the link. It expires in 48 hours. If you did not request this, ignore this email.'
                    : 'Bestätigen Sie Ihr Abonnement über den Link. Dieser ist 48 Stunden gültig. Falls Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail.',
              };
            }
            // Future newsletter campaigns must recheck live subscription state before every send.
            if (job.kind === 'NEWSLETTER') {
              const p = job.payload as { subscriptionId?: string };
              const subscription = p.subscriptionId
                ? await this.repository.findUniqueNewsletterSubscription({
                    where: { id: p.subscriptionId },
                  })
                : null;
              if (
                !subscription ||
                subscription.state !== 'CONFIRMED' ||
                subscription.email !== job.recipient
              ) {
                await this.repository.updateNotification({
                  where: { id: job.id },
                  data: { state: 'CANCELLED' },
                });
                continue;
              }
              if (
                !process.env.PUBLIC_APP_URL ||
                !process.env.NEWSLETTER_TOKEN_SECRET
              )
                continue;
              payload = {
                ...(job.payload as object),
                unsubscribeUrl: new URL(
                  '/newsletter/unsubscribe#token=' +
                    newsletterToken(subscription.id, 'withdraw', 0),
                  process.env.PUBLIC_APP_URL,
                ).toString(),
              };
            }
            const result = await this.send(gateway, gatewayKey, job.id, {
              kind: job.kind,
              recipient: job.recipient,
              payload,
            });
            if (result.accepted !== true)
              throw new Error('Delivery not accepted');
            await this.repository.updateNotification({
              where: { id: job.id },
              data: {
                state: 'SENT',
                attempts: { increment: 1 },
                lastError: null,
              },
            });
          } catch {
            await this.repository.updateNotification({
              where: { id: job.id },
              data: {
                state: job.attempts >= 4 ? 'FAILED' : 'PENDING',
                attempts: { increment: 1 },
                lastError: 'Email provider unavailable',
              },
            });
          }
        }
      }
    } catch {
      this.logger.error('Delivery worker could not process queued work.');
    } finally {
      this.busy = false;
    }
  }
}

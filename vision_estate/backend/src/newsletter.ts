import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { ApplicationRepository } from './application.repository';
import { hashToken } from './auth-crypto';

import * as germanConsent from './templates/consent/de-DE.json';
import * as englishConsent from './templates/consent/en.json';
export const CONSENT_VERSION = germanConsent.version;
export const consentCopy = (locale?: string) => locale === 'en' || locale === 'en-GB' ? englishConsent : germanConsent;

// Purpose-bound signed capabilities. Only their hashes are persisted; outbox rows hold no bearer tokens.
export function newsletterToken(
  id: string,
  purpose: 'confirm' | 'withdraw',
  expires: number,
) {
  const secret = process.env.NEWSLETTER_TOKEN_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('NEWSLETTER_TOKEN_SECRET is not configured');
  const body = Buffer.from(JSON.stringify({ id, purpose, expires })).toString(
    'base64url',
  );
  return (
    body + '.' + createHmac('sha256', secret).update(body).digest('base64url')
  );
}
function readToken(token: string, purpose: 'confirm' | 'withdraw') {
  try {
    if (typeof token !== 'string' || token.length > 1024) throw new Error();
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) throw new Error();
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (
      typeof payload.id !== 'string' ||
      payload.purpose !== purpose ||
      !Number.isSafeInteger(payload.expires)
    )
      throw new Error();
    const expected = newsletterToken(payload.id, purpose, payload.expires);
    if (
      expected.length !== token.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(token))
    )
      throw new Error();
    if (purpose === 'confirm' && payload.expires <= Date.now())
      throw new Error();
    return payload as { id: string; expires: number };
  } catch {
    throw new BadRequestException('This link is invalid or expired.');
  }
}
class TokenDto {
  @IsString() @MaxLength(1024) token: string;
}

@Injectable()
export class NewsletterService {
  constructor(private repository: ApplicationRepository) {}

  /** Called inside the intake transaction. Unticked forms never call this method. */
  async request(email: string, locale: string, ip: string) {
    const normalized = email.trim().toLowerCase();
    // Updating the normalized email locks the unique row, serializing concurrent requests.
    // A confirmed subscription is never reset by an anonymous intake request.
    const subscription = await this.repository.upsertNewsletterSubscription({
      where: { email: normalized },
      update: { email: normalized },
      create: {
        email: normalized,
        state: 'PENDING',
        confirmTokenExpiresAt: new Date(Date.now() + 48 * 3600000),
      },
    });
    if (subscription.state === 'CONFIRMED') return;
    const claimed = await this.repository.updateManyNewsletterSubscription({
      where: {
        id: subscription.id,
        OR: [
          { state: 'NONE' },
          { state: 'WITHDRAWN' },
          { state: 'PENDING', confirmTokenExpiresAt: { lt: new Date() } },
        ],
      },
      data: {
        state: 'PENDING',
        confirmTokenHash: null,
        confirmTokenExpiresAt: new Date(Date.now() + 48 * 3600000),
        confirmedAt: null,
        withdrawnAt: null,
      },
    });
    // A stable job ID deduplicates repeated opt-ins in the same confirmation window.
    const current = claimed.count
      ? await this.repository.findUniqueNewsletterSubscription({
          where: { id: subscription.id },
        })
      : subscription;
    if (!current?.confirmTokenExpiresAt) return;
    const jobId = hashToken(
      'newsletter:' +
        current.id +
        ':' +
        current.confirmTokenExpiresAt.toISOString(),
    );
    const prior = await this.repository.findUniqueNotification({
      where: { id: jobId },
    });
    if (prior) return;
    const copy = consentCopy(locale);
    await this.repository.createConsent({
      data: {
        userId: current.id,
        consentType: 'NEWSLETTER',
        action: 'GRANTED',
        source: 'INTAKE_REQUEST:' + copy.locale + ':' + copy.version,
        ipAddress: hashToken(ip || 'unknown'),
      },
    });
    await this.repository.createAuditLog({
      data: {
        actorId: current.id,
        entityId: current.id,
        entityType: 'NEWSLETTER',
        action: 'NEWSLETTER_REQUESTED',
        metadata: {
          locale: copy.locale,
          version: copy.version,
          wording: copy.newsletter,
        },
      },
    });
    await this.repository.createNotification({
      data: {
        id: jobId,
        kind: 'NEWSLETTER_CONFIRM',
        recipient: normalized,
        payload: {
          subscriptionId: current.id,
          locale: copy.locale,
          version: copy.version,
          expiresAt: current.confirmTokenExpiresAt.toISOString(),
        },
      },
    });
  }
  async confirm(token: string, ip: string) {
    const payload = readToken(token, 'confirm');
    return this.repository.transaction(async (tx) => {
      const changed = await tx.updateManyNewsletterSubscription({
        where: {
          id: payload.id,
          state: 'PENDING',
          confirmTokenHash: hashToken(token),
          confirmTokenExpiresAt: { gt: new Date() },
        },
        data: {
          state: 'CONFIRMED',
          confirmedAt: new Date(),
          confirmTokenHash: null,
          confirmTokenExpiresAt: null,
        },
      });
      if (!changed.count)
        throw new ConflictException(
          'This link has already been used or is no longer valid.',
        );
      await tx.createConsent({
        data: {
          userId: payload.id,
          consentType: 'NEWSLETTER',
          action: 'GRANTED',
          source: 'DOUBLE_OPT_IN_LINK',
          ipAddress: hashToken(ip || 'unknown'),
        },
      });
      await tx.createAuditLog({
        data: {
          actorId: payload.id,
          entityId: payload.id,
          entityType: 'NEWSLETTER',
          action: 'NEWSLETTER_CONFIRMED',
        },
      });
      return { state: 'CONFIRMED' };
    });
  }
  async unsubscribe(token: string, ip: string) {
    const payload = readToken(token, 'withdraw');
    return this.repository.transaction(async (tx) => {
      const changed = await tx.updateManyNewsletterSubscription({
        where: { id: payload.id, state: { in: ['CONFIRMED', 'PENDING'] } },
        data: {
          state: 'WITHDRAWN',
          withdrawnAt: new Date(),
          confirmTokenHash: null,
          confirmTokenExpiresAt: null,
        },
      });
      if (changed.count) {
        await tx.createConsent({
          data: {
            userId: payload.id,
            consentType: 'NEWSLETTER',
            action: 'WITHDRAWN',
            source: 'UNSUBSCRIBE_LINK',
            ipAddress: hashToken(ip || 'unknown'),
          },
        });
        await tx.createAuditLog({
          data: {
            actorId: payload.id,
            entityId: payload.id,
            entityType: 'NEWSLETTER',
            action: 'NEWSLETTER_WITHDRAWN',
          },
        });
      }
      return { state: 'WITHDRAWN' };
    });
  }
  async expire() {
    return this.repository.updateManyNewsletterSubscription({
      where: { state: 'PENDING', confirmTokenExpiresAt: { lte: new Date() } },
      data: {
        state: 'NONE',
        confirmTokenHash: null,
        confirmTokenExpiresAt: null,
      },
    });
  }
}
@Controller('v1/newsletter')
export class NewsletterController {
  constructor(private service: NewsletterService) {}
  @Get('copy') copy(@Query('locale') locale?: string) {
    return consentCopy(locale);
  }
  @Get('confirm') confirm(@Query() query: TokenDto, @Req() req: Request) {
    return this.service.confirm(query.token, req.ip || '');
  }
  @Post('unsubscribe') unsubscribe(
    @Body() body: TokenDto,
    @Req() req: Request,
  ) {
    return this.service.unsubscribe(body.token, req.ip || '');
  }
}

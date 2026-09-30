import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApplicationRepository } from '../application.repository';
import { hashToken, AuthRequest } from '../auth';
import { CreatePropertyDto } from './dto/create-property.dto';
import { scoreLead } from './scoring';
import { NewsletterService, consentCopy } from '../newsletter';
@Injectable()
export class PropertiesService {
  constructor(private repository: ApplicationRepository) {}
  async authorize(
    propertyId: string,
    accessToken: string,
    actor?: AuthRequest['user'],
  ) {
    const property = await this.repository.findUniqueProperty({
      where: { id: propertyId },
    });
    if (property && actor) {
      if (actor.role === 'ADMIN') return property;
      const lead = await this.repository.findUniqueLead({
        where: { propertyId },
      });
      if (lead?.assignedToId === actor.id) return property;
      throw new ForbiddenException(
        'This assessment is assigned to another broker.',
      );
    }
    if (
      !property?.accessTokenHash ||
      property.accessTokenHash !== hashToken(accessToken || '')
    )
      throw new ForbiddenException(
        'This assessment is private. Open it from the browser used to submit it.',
      );
    return property;
  }
  async create(
    dto: CreatePropertyDto,
    clientIp: string,
    key: string,
    accessToken: string,
  ) {
    if (!key || !/^[\w-]{16,100}$/.test(key))
      throw new BadRequestException('A valid idempotency-key is required.');
    if (!/^[a-f0-9]{64}$/.test(accessToken || ''))
      throw new BadRequestException(
        'A secure assessment access token is required.',
      );
    const submissionHash = hashToken(JSON.stringify(dto));
    const existing = await this.repository.findUniqueProperty({
      where: { submissionKey: key },
    });
    if (existing) {
      if (
        existing.submissionHash !== submissionHash ||
        existing.accessTokenHash !== hashToken(accessToken)
      )
        throw new ConflictException(
          'This submission key was already used for different data.',
        );
      return { id: existing.id, state: existing.state };
    }
    try {
      return await this.repository.transaction(async (tx) => {
        const property = await tx.createProperty({
          data: {
            address: { ...dto.address, country: 'DE' },
            propertyType: dto.propertyType,
            sizeSqm: dto.sizeSqm,
            condition: dto.condition,
            yearBuilt: dto.yearBuilt,
            rooms: dto.rooms,
            features: dto.features || [],
            sellingTimeline: dto.sellingTimeline || 'EXPLORING',
            sellerContact: { ...dto.sellerContact },
            locale: dto.locale === 'en-GB' ? 'en' : dto.locale || 'de-DE',
            state: 'SUBMITTED',
            submissionKey: key,
            submissionHash,
            accessTokenHash: hashToken(accessToken),
          },
        });
        await tx.createLead({
          data: { propertyId: property.id, ...scoreLead(dto) },
        });
        if (dto.newsletterOptIn)
          await new NewsletterService(tx).request(
            dto.sellerContact.email,
            property.locale,
            clientIp,
          );
        await tx.createConsent({
          data: {
            userId: property.id,
            consentType: 'DATA_PROCESSING',
            action: 'GRANTED',
            source:
              'SELLER_INTAKE:' +
              property.locale +
              ':' +
              consentCopy(property.locale).version,
            ipAddress: hashToken(clientIp || 'unknown'),
          },
        });
        await tx.createAuditLog({
          data: {
            actorId: property.id,
            action: 'PROPERTY_SUBMITTED',
            entityType: 'PROPERTY',
            entityId: property.id,
            metadata: {
              consentVersion: consentCopy(property.locale).version,
              processingCopy: consentCopy(property.locale).processing,
            },
          },
        });
        if (process.env.BROKER_NOTIFICATION_EMAIL)
          await tx.createNotification({
            data: {
              kind: 'NEW_LEAD',
              recipient: process.env.BROKER_NOTIFICATION_EMAIL,
              payload: { propertyId: property.id },
            },
          });
        return { id: property.id, state: property.state };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const saved = await this.repository.findUniqueProperty({
          where: { submissionKey: key },
        });
        if (
          saved?.submissionHash === submissionHash &&
          saved.accessTokenHash === hashToken(accessToken)
        )
          return { id: saved.id, state: saved.state };
        throw new ConflictException('Submission conflict. Please retry.');
      }
      throw error;
    }
  }
}

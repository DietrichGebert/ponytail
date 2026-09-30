import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AdminGuard, AuthGuard, AuthRequest } from './auth';
import { hashToken, passwordHash } from './auth-crypto';
import { ApplicationRepository } from './application.repository';

export function invitationToken(id: string, expires: number) {
  const key = process.env.AUTH_JWT_SECRET || '';
  if (Buffer.byteLength(key) < 32)
    throw new ServiceUnavailableException(
      'Staff authentication requires a configured signing key.',
    );
  const value = Buffer.from(
    JSON.stringify({ purpose: 'staff-invitation', id, expires }),
  ).toString('base64url');
  return (
    value + '.' + createHmac('sha256', key).update(value).digest('base64url')
  );
}
function readInvitation(token: string) {
  try {
    if (typeof token !== 'string' || token.length > 1024) throw new Error();
    const value = JSON.parse(
      Buffer.from(token.split('.')[0], 'base64url').toString(),
    );
    if (
      value.purpose !== 'staff-invitation' ||
      typeof value.id !== 'string' ||
      !Number.isSafeInteger(value.expires) ||
      value.expires <= Date.now()
    )
      throw new Error();
    const expected = invitationToken(value.id, value.expires);
    if (
      expected.length !== token.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(token))
    )
      throw new Error();
    return value as { id: string; expires: number };
  } catch {
    throw new BadRequestException(
      'This invitation is invalid, expired or already used.',
    );
  }
}
export class InviteBrokerDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsIn(['de-DE', 'en']) locale = 'de-DE';
}
export class InvitationTokenDto {
  @IsString() @MaxLength(1024) token: string;
}
export class AcceptInvitationDto extends InvitationTokenDto {
  @IsString() @MinLength(12) @MaxLength(128) password: string;
}
@Injectable()
export class StaffInvitationsService {
  constructor(private repository: ApplicationRepository) {}
  async invite(dto: InviteBrokerDto, actor: AuthRequest['user']) {
    const id = randomUUID(),
      expiresAt = new Date(Date.now() + 48 * 3600000);
    const tokenHash = hashToken(invitationToken(id, expiresAt.getTime()));
    try {
      return await this.repository.transaction(async (tx) => {
        const user = await tx.createUser({
          data: {
            email: dto.email.trim().toLowerCase(),
            name: dto.name.trim(),
            role: 'BROKER',
            active: false,
            passwordHash: passwordHash(randomBytes(48).toString('hex')),
          },
        });
        await tx.createStaffInvitation({
          data: {
            id,
            userId: user.id,
            invitedById: actor.id,
            tokenHash,
            expiresAt,
          },
        });
        await tx.createNotification({
          data: {
            kind: 'BROKER_INVITATION',
            recipient: user.email,
            payload: {
              invitationId: id,
              locale: dto.locale,
              expiresAt: expiresAt.toISOString(),
            },
          },
        });
        await tx.createAuditLog({
          data: {
            actorId: actor.id,
            action: 'BROKER_INVITED',
            entityType: 'USER',
            entityId: user.id,
          },
        });
        return {
          invitationId: id,
          expiresAt,
          state: 'PENDING_VERIFICATION',
          delivery: 'QUEUED',
        };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(
          'An account with this email already exists.',
        );
      throw e;
    }
  }
  private async pending(token: string, repository = this.repository) {
    const value = readInvitation(token);
    const invitation = await repository.findUniqueStaffInvitation({
      where: { id: value.id },
      include: { user: true },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.user.active ||
      invitation.expiresAt.getTime() !== value.expires ||
      invitation.tokenHash !== hashToken(token)
    )
      throw new BadRequestException(
        'This invitation is invalid, expired or already used.',
      );
    return invitation;
  }
  async inspect(token: string) {
    const invite = await this.pending(token);
    return {
      name: invite.user.name,
      email: invite.user.email,
      expiresAt: invite.expiresAt,
    };
  }
  async accept(dto: AcceptInvitationDto) {
    const hash = passwordHash(dto.password);
    return this.repository.transaction(async (tx) => {
      let invite = await this.pending(dto.token, tx);
      await tx.lockStaffUser(invite.userId);
      invite = await this.pending(dto.token, tx);
      const claimed = await tx.updateManyStaffInvitation({
        where: {
          id: invite.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (!claimed.count)
        throw new ConflictException('This invitation is no longer available.');
      await tx.updateUser({
        where: { id: invite.userId },
        data: { passwordHash: hash, active: true },
      });
      await tx.createAuditLog({
        data: {
          actorId: invite.userId,
          action: 'BROKER_EMAIL_VERIFIED',
          entityType: 'USER',
          entityId: invite.userId,
        },
      });
      return { state: 'VERIFIED' };
    });
  }
  async revoke(id: string, actor: AuthRequest['user']) {
    return this.repository.transaction(async (tx) => {
      const changed = await tx.updateManyStaffInvitation({
        where: { id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (changed.count)
        await tx.createAuditLog({
          data: {
            actorId: actor.id,
            action: 'BROKER_INVITATION_REVOKED',
            entityType: 'STAFF_INVITATION',
            entityId: id,
          },
        });
      return { ok: true };
    });
  }
  async resend(id: string, actor: AuthRequest['user']) {
    return this.repository.transaction(async (tx) => {
      let invite = await tx.findUniqueStaffInvitation({
        where: { id },
        include: { user: true },
      });
      if (!invite) throw new BadRequestException('Invitation not found.');
      await tx.lockStaffUser(invite.userId);
      invite = await tx.findUniqueStaffInvitation({
        where: { id },
        include: { user: true },
      });
      if (invite.acceptedAt || invite.user.active)
        throw new ConflictException('This account has already been verified.');
      const expiresAt = new Date(
        Math.max(Date.now() + 48 * 3600000, invite.expiresAt.getTime() + 1),
      );
      const tokenHash = hashToken(invitationToken(id, expiresAt.getTime()));
      await tx.updateManyStaffInvitation({
        where: { id, acceptedAt: null },
        data: { expiresAt, tokenHash, revokedAt: null },
      });
      await tx.createNotification({
        data: {
          kind: 'BROKER_INVITATION',
          recipient: invite.user.email,
          payload: {
            invitationId: id,
            locale: 'de-DE',
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
      await tx.createAuditLog({
        data: {
          actorId: actor.id,
          action: 'BROKER_INVITATION_REISSUED',
          entityType: 'STAFF_INVITATION',
          entityId: id,
        },
      });
      return {
        invitationId: id,
        expiresAt,
        state: 'PENDING_VERIFICATION',
        delivery: 'QUEUED',
      };
    });
  }
}
@Controller('v1')
export class StaffInvitationsController {
  constructor(private service: StaffInvitationsService) {}
  @Post('admin/broker-invitations/:id/resend')
  @UseGuards(AuthGuard, AdminGuard)
  resend(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.service.resend(id, req.user);
  }
  @Post('admin/broker-invitations')
  @UseGuards(AuthGuard, AdminGuard)
  invite(@Body() dto: InviteBrokerDto, @Req() req: AuthRequest) {
    return this.service.invite(dto, req.user);
  }
  @Delete('admin/broker-invitations/:id')
  @UseGuards(AuthGuard, AdminGuard)
  revoke(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.service.revoke(id, req.user);
  }
  @Post('auth/invitation/inspect')
  inspect(@Body() dto: InvitationTokenDto) {
    return this.service.inspect(dto.token);
  }
  @Post('auth/invitation/accept')
  accept(@Body() dto: AcceptInvitationDto) {
    return this.service.accept(dto);
  }
}

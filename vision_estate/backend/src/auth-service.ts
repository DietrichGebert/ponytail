import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { ApplicationRepository } from './application.repository';
import { hashToken, verifyPassword } from './auth-crypto';
import {
  issueAccessToken,
  REFRESH_SECONDS,
  verifyAccessToken,
} from './access-token';
@Injectable()
export class AuthService {
  constructor(private repository: ApplicationRepository) {}
  private async pair(
    user: { id: string; name: string; role: string },
    familyId: string,
    expiresAt: Date,
  ) {
    const token = randomBytes(32).toString('hex');
    const id = randomUUID();
    const accessToken = await issueAccessToken(user.id, id);
    return {
      token,
      accessToken,
      expiresAt,
      identity: { id: user.id, name: user.name, role: user.role },
      data: {
        id,
        tokenHash: hashToken(token),
        userId: user.id,
        familyId,
        expiresAt,
      },
    };
  }
  async login(dto: { email: string; password: string }) {
    const user = await this.repository.findUniqueUser({
      where: { email: dto.email.trim().toLowerCase() },
    });
    const valid = verifyPassword(
      dto.password,
      user?.passwordHash || '0'.repeat(32) + ':' + '0'.repeat(128),
    );
    if (!user?.active || !valid)
      throw new UnauthorizedException('Email or password is incorrect.');
    return this.repository.transaction(async (tx) => {
      // Serialize with account deactivation, so it cannot leave a newly minted
      // session behind after revoking the user's existing sessions.
      await tx.lockStaffUser(user.id);
      const current = await tx.findUniqueUser({ where: { id: user.id } });
      if (!current?.active || current.passwordHash !== user.passwordHash)
        throw new UnauthorizedException('Email or password is incorrect.');
      const pair = await this.pair(
        current,
        randomUUID(),
        new Date(Date.now() + REFRESH_SECONDS * 1000),
      );
      await tx.createSession({ data: pair.data });
      const { data: _, ...result } = pair;
      return result;
    });
  }
  async refresh(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token || ''))
      throw new UnauthorizedException('Please sign in again.');
    const result = await this.repository.transaction(async (tx) => {
      let old = await tx.findUniqueSession({
        where: { tokenHash: hashToken(token) },
        include: { user: true },
      });
      if (!old?.familyId) return null;
      await tx.lockSessionFamily(old.familyId);
      await tx.lockStaffUser(old.userId);
      old = await tx.findUniqueSession({
        where: { id: old.id },
        include: { user: true },
      });
      if (
        !old?.familyId ||
        old.revokedAt ||
        old.expiresAt <= new Date() ||
        !old.user.active
      )
        return null;
      const claimed = await tx.updateManySession({
        where: { id: old.id, consumedAt: null, revokedAt: null },
        data: { consumedAt: new Date() },
      });
      if (!claimed.count) {
        // Commit the revocation before returning 401; throwing here would roll it back.
        await tx.updateManySession({
          where: { familyId: old.familyId },
          data: { revokedAt: new Date() },
        });
        await tx.createAuditLog({
          data: {
            actorId: old.userId,
            action: 'REFRESH_TOKEN_REUSE',
            entityType: 'SESSION',
            entityId: old.familyId,
          },
        });
        return null;
      }
      const pair = await this.pair(old.user, old.familyId, old.expiresAt);
      await tx.createSession({ data: pair.data });
      const { data: _, ...response } = pair;
      return response;
    });
    if (!result) throw new UnauthorizedException('Please sign in again.');
    return result;
  }
  async logout(token: string, accessToken = '') {
    let row = /^[a-f0-9]{64}$/.test(token || '')
      ? await this.repository.findUniqueSession({
          where: { tokenHash: hashToken(token) },
        })
      : null;
    if (!row && accessToken) {
      try {
        const claims = await verifyAccessToken(accessToken);
        row = await this.repository.findUniqueSession({
          where: { id: claims.sessionId },
        });
      } catch (error) {
        if (!(error instanceof UnauthorizedException)) throw error;
      }
    }
    if (row?.familyId)
      await this.repository.transaction(async (tx) => {
        await tx.lockSessionFamily(row.familyId);
        await tx.updateManySession({
          where: { familyId: row.familyId },
          data: { revokedAt: new Date() },
        });
      });
    else if (row)
      await this.repository.deleteManySession({ where: { id: row.id } });
  }
}

import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
export const ACCESS_SECONDS = 10 * 60;
export const REFRESH_SECONDS = 7 * 24 * 60 * 60;
const issuer = 'vision-estates';
const audience = 'vision-estates-api';
function signingKey() {
  const secret = process.env.AUTH_JWT_SECRET || '';
  if (Buffer.byteLength(secret) < 32)
    throw new ServiceUnavailableException(
      'Staff authentication requires a configured signing key.',
    );
  return new TextEncoder().encode(secret);
}
export async function issueAccessToken(userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_SECONDS}s`)
    .sign(signingKey());
}
export async function verifyAccessToken(token: string) {
  const key = signingKey();
  try {
    if (token.length > 4096) throw new Error('oversized');
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer,
      audience,
      typ: 'JWT',
      requiredClaims: ['sub', 'sid', 'iat', 'exp', 'jti'],
      maxTokenAge: `${ACCESS_SECONDS}s`,
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string')
      throw new Error('claims');
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    throw new UnauthorizedException('Please sign in to continue.');
  }
}

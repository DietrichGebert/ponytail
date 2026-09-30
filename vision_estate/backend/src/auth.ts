import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { ApplicationRepository } from './application.repository';
import { hashToken } from './auth-crypto';
import { AuthService } from './auth-service';
import { ACCESS_SECONDS, verifyAccessToken } from './access-token';
export { hashToken, passwordHash, verifyPassword } from './auth-crypto';
export type AuthRequest = Request & { user: User };
function cookieToken(req: Request, name: string) {
  return (
    (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(name + '='))
      ?.slice(name.length + 1) || ''
  );
}
function bearerToken(req: Request) {
  return req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : cookieToken(req, 've_access');
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private repository: ApplicationRepository) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const access = bearerToken(req);
    if (access) {
      const claims = await verifyAccessToken(access);
      const session = await this.repository.findUniqueSession({
        where: { id: claims.sessionId },
        include: { user: true },
      });
      if (
        !session?.familyId ||
        session.consumedAt ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        !session.user.active ||
        session.userId !== claims.userId
      )
        throw new UnauthorizedException('Please sign in to continue.');
      req.user = session.user;
      return true;
    }
    const token = cookieToken(req, 've_session');
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Please sign in to continue.');
    const session = await this.repository.findUniqueSession({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.familyId ||
      session.expiresAt <= new Date() ||
      !session.user.active
    )
      throw new UnauthorizedException('Please sign in to continue.');
    req.user = session.user;
    return true;
  }
}
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (context.switchToHttp().getRequest<AuthRequest>().user?.role !== 'ADMIN')
      throw new ForbiddenException('Administrator access required.');
    return true;
  }
}
class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) @MaxLength(256) password: string;
}
@Injectable()
export class OptionalStaffGuard extends AuthGuard {
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.headers['x-assessment-token']) return true;
    if (
      !req.headers.authorization &&
      !cookieToken(req, 've_access') &&
      !cookieToken(req, 've_session')
    )
      return true;
    return super.canActivate(context);
  }
}
@Controller('v1/auth')
export class AuthController {
  constructor(private application: AuthService) {}
  private cookies(
    res: Response,
    result: Awaited<ReturnType<AuthService['login']>>,
  ) {
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };
    res.cookie('ve_access', result.accessToken, {
      ...options,
      maxAge: ACCESS_SECONDS * 1000,
    });
    res.cookie('ve_refresh', result.token, {
      ...options,
      expires: result.expiresAt,
    });
    res.clearCookie('ve_session', { path: '/' });
    return {
      ...result.identity,
      accessToken: result.accessToken,
      expiresIn: ACCESS_SECONDS,
      tokenType: 'Bearer',
    };
  }
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cookies(res, await this.application.login(dto));
  }
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cookies(
      res,
      await this.application.refresh(cookieToken(req, 've_refresh')),
    );
  }
  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthRequest) {
    return { id: req.user.id, name: req.user.name, role: req.user.role };
  }
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.application.logout(
      cookieToken(req, 've_refresh') || cookieToken(req, 've_session'),
      bearerToken(req),
    );
    for (const name of ['ve_session', 've_access', 've_refresh'])
      res.clearCookie(name, { path: '/' });
    return { ok: true };
  }
  @Delete('session')
  revoke(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.logout(req, res);
  }
}

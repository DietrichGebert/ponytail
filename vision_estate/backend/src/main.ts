import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { serveApiDocs } from './openapi';
import { ProblemDetailsFilter } from './properties/problem-details.filter';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origins = (process.env.APP_ORIGIN || 'http://localhost:3000').split(
    ',',
  );
  // API is private behind the same-origin Next.js proxy by default.
  app.enableCors({ origin: origins, credentials: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Request-Id', randomUUID());
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      !origins.includes(req.headers.origin)
    )
      return res.status(403).type('application/problem+json').json({
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'Origin not allowed.',
        instance: req.path,
      });
    next();
  });
  // Single-instance fallback; replace with a shared edge/Redis limiter before scaling.
  const limits = new Map<string, { count: number; until: number }>();
  const sweep = setInterval(() => {
    for (const [key, value] of limits)
      if (value.until < Date.now()) limits.delete(key);
  }, 60000);
  sweep.unref();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      (req.method === 'GET' && !req.path.endsWith('/newsletter/confirm')) ||
      req.method === 'OPTIONS'
    )
      return next();
    const key =
      (req.ip || 'unknown') +
      ':' +
      (req.path.includes('/auth/login') ? 'login' : 'write');
    const previous = limits.get(key);
    const record =
      previous && previous.until > Date.now()
        ? previous
        : { count: 0, until: Date.now() + 60000 };
    record.count++;
    limits.set(key, record);
    if (record.count > (req.path.includes('/auth/login') ? 15 : 100)) {
      res.setHeader('Retry-After', '60');
      return res.status(429).type('application/problem+json').json({
        type: 'about:blank',
        title: 'Too many requests',
        status: 429,
        detail: 'Too many requests. Please retry in a minute.',
        instance: req.path,
      });
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  serveApiDocs(app);
  app.enableShutdownHooks();
  await app.listen(
    Number(process.env.PORT || 3001),
    process.env.HOST || '127.0.0.1',
  );
}
void bootstrap();

import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { LeadQueryRepository } from '../src/properties/lead-query.repository';
import { ProblemDetailsFilter } from '../src/properties/problem-details.filter';
describe('API authorization and validation (isolated database adapter)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        property: { findUnique: async () => null },
        session: {
          findUnique: async () => ({
            expiresAt: new Date(Date.now() + 60000),
            user: { id: 'broker-a', role: 'BROKER', active: true },
          }),
        },
      })
      .overrideProvider(LeadQueryRepository)
      .useValue({
        list: async (_actor, assignedToId, query) => ({
          items: [],
          total: 0,
          page: query.page,
          stage: query.stage,
          q: query.q,
          assignedToId,
        }),
      })
      .compile();
    app = fixture.createNestApplication();
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('serves liveness without exposing data', () =>
    request(app.getHttpServer())
      .get('/v1/health/live')
      .expect(200, { status: 'ok' }));
  it('serves versioned German consent copy without authentication', () =>
    request(app.getHttpServer())
      .get('/v1/newsletter/copy')
      .expect(200)
      .expect(({ body }) => {
        expect(body.locale).toBe('de-DE');
        expect(body.newsletter).toContain('freiwillig');
        expect(body.version).toBeTruthy();
      }));
  it('rejects invalid newsletter links', () =>
    request(app.getHttpServer())
      .get('/v1/newsletter/confirm?token=invalid')
      .expect(400));
  it('rejects unknown unsubscribe fields', () =>
    request(app.getHttpServer())
      .post('/v1/newsletter/unsubscribe')
      .send({ token: 'invalid', email: 'not-allowed@example.invalid' })
      .expect(400));
  it('denies anonymous broker access', () =>
    request(app.getHttpServer())
      .get('/v1/leads')
      .expect(401)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          type: 'about:blank',
          status: 401,
          instance: '/v1/leads',
        });
      }));
  it('denies anonymous administration', () =>
    request(app.getHttpServer()).get('/v1/admin/overview').expect(401));
  it('rejects refresh without its private cookie', () =>
    request(app.getHttpServer()).post('/v1/auth/refresh').expect(401));
  it('requires admin authorization to invite brokers', () =>
    request(app.getHttpServer())
      .post('/v1/admin/broker-invitations')
      .expect(401));
  it('denies broker access to staff and audit listings', async () => {
    for (const path of ['/v1/admin/users', '/v1/admin/audit-logs'])
      await request(app.getHttpServer())
        .get(path)
        .set('Cookie', 've_session=' + 'a'.repeat(64))
        .expect(403);
  });
  it('rejects invalid invitation links', () =>
    request(app.getHttpServer())
      .post('/v1/auth/invitation/inspect')
      .send({ token: 'invalid' })
      .expect(400));
  it('rejects role escalation in invitation acceptance', () =>
    request(app.getHttpServer())
      .post('/v1/auth/invitation/accept')
      .send({
        token: 'invalid',
        password: 'sufficiently-long-password',
        role: 'ADMIN',
      })
      .expect(400));
  it('validates cursor limits before querying records', () =>
    request(app.getHttpServer())
      .get('/v1/properties?limit=1000')
      .set('Cookie', 've_session=' + 'a'.repeat(64))
      .expect(400));
  it('does not expose anonymous property records', () =>
    request(app.getHttpServer())
      .get('/v1/properties/00000000-0000-4000-8000-000000000001')
      .expect(403));
  it('rejects invalid property payloads', () =>
    request(app.getHttpServer())
      .post('/v1/properties')
      .send({ sizeSqm: -10 })
      .expect(400));
  it('validates broker query parameters before repository access', () =>
    request(app.getHttpServer())
      .get('/v1/leads?page=1.5&stage=INVALID')
      .set('Cookie', 've_session=' + 'a'.repeat(64))
      .expect(400));
  it('transforms a search query and preserves broker scope', () =>
    request(app.getHttpServer())
      .get('/v1/leads?page=2&stage=NEW&q=%20Munich%20')
      .set('Cookie', 've_session=' + 'a'.repeat(64))
      .expect(200, {
        items: [],
        total: 0,
        page: 2,
        stage: 'NEW',
        q: 'Munich',
        assignedToId: 'broker-a',
      }));
});

import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import { createApiDocument, schemas } from './openapi';
import { CreatePropertyDto } from './properties/dto/create-property.dto';

describe('Published API contract', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
  });
  afterAll(async () => {
    await app.close();
  });
  it('is a valid OpenAPI document generated without database initialization', async () => {
    const document = createApiDocument(app);
    await expect(
      SwaggerParser.validate(JSON.parse(JSON.stringify(document))),
    ).resolves.toBeDefined();
    expect(
      Object.values(document.paths).flatMap((p) => Object.keys(p)),
    ).toHaveLength(39);
  });
  it('documents real cookie/owner access and required intake headers', () => {
    const document = createApiDocument(app);
    expect(document.paths['/v1/leads'].get.security).toEqual([
      { bearer: [] },
      { accessCookie: [] },
      { session: [] },
    ]);
    expect(document.paths['/v1/properties/{id}/status'].get.security).toEqual([
      { assessment: [] },
    ]);
    expect(document.paths['/v1/properties'].post.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'idempotency-key', required: true }),
        expect.objectContaining({ name: 'x-assessment-token', required: true }),
      ]),
    );
    expect(document.components.securitySchemes).toHaveProperty('bearer');
  });
  it('agrees with intake validation for malformed and valid representative inputs', () => {
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    const schema = ajv.compile({
      $ref: '#/components/schemas/CreateProperty',
      components: { schemas },
    });
    const valid = {
      address: { street: 'Test 1', postalCode: '80802', city: 'Munich' },
      propertyType: 'HOUSE',
      sizeSqm: 100,
      condition: 'GOOD',
      yearBuilt: 2000,
      sellerContact: { name: 'Test', email: 'test@example.invalid' },
      dataProcessingConsent: true,
    };
    for (const input of [
      valid,
      { ...valid, sizeSqm: -1 },
      { ...valid, dataProcessingConsent: false },
      { ...valid, sellerContact: { name: 'Test', email: 'wrong' } },
      { ...valid, features: ['UNKNOWN'] },
      { ...valid, rooms: 1.5 },
      { ...valid, rooms: null },
      { ...valid, features: null },
    ]) {
      expect(schema(input)).toBe(
        validateSync(plainToInstance(CreatePropertyDto, input), {
          whitelist: true,
          forbidNonWhitelisted: true,
        }).length === 0,
      );
    }
  });
  it('accepts nullable database fields but requires pagination totals', () => {
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    const validate = ajv.compile({
      $ref: '#/components/schemas/LeadPage',
      components: { schemas },
    });
    expect(validate({ items: [], total: 0, page: 1, pageSize: 50 })).toBe(true);
    expect(validate({ items: [], page: 1, pageSize: 50 })).toBe(false);
    const scoreBand = ajv.compile(schemas.LeadRecord.properties.scoreBand);
    expect(scoreBand(null)).toBe(true);
    expect(scoreBand('HOT')).toBe(true);
    expect(scoreBand('UNKNOWN')).toBe(false);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ProblemDetailsFilter } from './problem-details.filter';
describe('Unavailable persistence error handling', () => {
  function result(error: unknown) {
    const response = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    new ProblemDetailsFilter().catch(error, {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ path: '/v1/properties' }),
      }),
    } as any);
    return response;
  }
  it('returns retryable 503 without database host or stack details', () => {
    const response = result(
      new Prisma.PrismaClientInitializationError(
        'secret database host',
        '5.18.0',
        'P1001',
      ),
    );
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DATABASE_UNAVAILABLE', status: 503 }),
    );
    expect(JSON.stringify(response.json.mock.calls)).not.toContain(
      'secret database host',
    );
  });
  it('distinguishes an unapplied schema migration from an unexpected 500', () => {
    const response = result(
      new Prisma.PrismaClientKnownRequestError('missing private table', {
        code: 'P2021',
        clientVersion: '5.18.0',
      }),
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'DATABASE_SCHEMA_OUTDATED',
        status: 503,
      }),
    );
  });
});

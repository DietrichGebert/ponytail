import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LeadQueryDto } from './dto/lead-query.dto';
import { LeadQueryService } from './lead-query.service';

describe('Lead query access policy', () => {
  it('restricts broker results to that broker regardless of search criteria', () => {
    const repository = { list: vi.fn() };
    const service = new LeadQueryService(repository as any);
    const query = plainToInstance(LeadQueryDto, { q: 'Munich', page: '2' });
    service.list({ id: 'broker-a', role: 'BROKER' }, query);
    expect(repository.list).toHaveBeenCalledWith('broker-a', 'broker-a', query);
  });
  it('allows the administrator to search the full pipeline', () => {
    const repository = { list: vi.fn() };
    new LeadQueryService(repository as any).list(
      { id: 'admin', role: 'ADMIN' },
      new LeadQueryDto(),
    );
    expect(repository.list).toHaveBeenCalledWith(
      'admin',
      null,
      expect.any(LeadQueryDto),
    );
  });
  it('denies unknown and future seller roles before any data access', () => {
    const repository = { list: vi.fn() };
    expect(() =>
      new LeadQueryService(repository as any).list(
        { id: 'seller', role: 'SELLER' },
        new LeadQueryDto(),
      ),
    ).toThrow('Broker access');
    expect(repository.list).not.toHaveBeenCalled();
  });
});

describe('Lead query validation', () => {
  it.each([
    { page: '1.5' },
    { page: '0' },
    { page: '10001' },
    { page: 'abc' },
    { stage: 'UNKNOWN' },
    { q: 'a'.repeat(121) },
    { q: ['one', 'two'] },
  ])('rejects malformed query %j', (input) => {
    expect(
      validateSync(plainToInstance(LeadQueryDto, input)).length,
    ).toBeGreaterThan(0);
  });
  it('defaults page and trims a literal search', () => {
    const query = plainToInstance(LeadQueryDto, {
      q: '  50%_home  ',
      stage: 'NEW',
    });
    expect(validateSync(query)).toHaveLength(0);
    expect(query.page).toBe(1);
    expect(query.q).toBe('50%_home');
  });
});

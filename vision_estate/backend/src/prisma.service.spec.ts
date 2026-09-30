import { describe, it, expect, vi } from 'vitest';
import { PrismaService } from './prisma.service';
describe('Database outage at startup', () => {
  it('keeps the API available to expose failing readiness', async () => {
    const context = {
      $connect: vi.fn().mockRejectedValue(new Error('unavailable')),
      startupLogger: { warn: vi.fn() },
    };
    await expect(
      PrismaService.prototype.onModuleInit.call(context),
    ).resolves.toBeUndefined();
    expect(context.startupLogger.warn).toHaveBeenCalledOnce();
  });
});

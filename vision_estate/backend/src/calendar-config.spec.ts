import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeliveryWorker } from './delivery-worker';
import { BookingService } from './booking-service';
import { integrationConfigured } from './integration-config';
afterEach(() => vi.unstubAllEnvs());
describe('Incomplete calendar configuration', () => {
  it.each([
    ['https://calendar.example.invalid', ''],
    ['http://calendar.example.invalid', 'key'],
    ['not-a-url', 'key'],
    ['https://name:password@calendar.example.invalid', 'key'],
  ])('rejects invalid gateway configuration %s', (url, key) => {
    expect(integrationConfigured(url, key)).toBe(false);
  });
  it('leaves pending reservations untouched when the calendar key is missing', async () => {
    vi.stubEnv('CALENDAR_GATEWAY_URL', 'https://calendar.example.invalid');
    vi.stubEnv('CALENDAR_GATEWAY_KEY', '');
    vi.stubEnv('EMAIL_GATEWAY_URL', '');
    vi.stubEnv('NEWSLETTER_EMAIL_GATEWAY_URL', '');
    const repo = {
      updateManyNewsletterSubscription: vi.fn(),
      findManyBooking: vi.fn(),
      updateManyBooking: vi.fn(),
    };
    await new DeliveryWorker(repo as any).tick();
    expect(repo.findManyBooking).not.toHaveBeenCalled();
    expect(repo.updateManyBooking).not.toHaveBeenCalled();
  });
  it('does not advertise bookable slots for a URL-only configuration', async () => {
    vi.stubEnv('CALENDAR_GATEWAY_URL', 'https://calendar.example.invalid');
    vi.stubEnv('CALENDAR_GATEWAY_KEY', '');
    const repo = { findUniqueLead: vi.fn() };
    const service = new BookingService(
      repo as any,
      { authorize: vi.fn() } as any,
    );
    await expect(service.slots('property', 'token')).rejects.toThrow(
      'not available',
    );
    expect(repo.findUniqueLead).not.toHaveBeenCalled();
  });
});

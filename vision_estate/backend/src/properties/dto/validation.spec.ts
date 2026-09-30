import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePropertyDto } from './create-property.dto';
describe('Seller submission validation', () => {
  it('rejects missing nested objects and consent', async () => {
    const errors = await validate(plainToInstance(CreatePropertyDto, {}));
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining([
        'address',
        'sellerContact',
        'dataProcessingConsent',
      ]),
    );
  });
  it('rejects negative size, fake types and invalid email', async () => {
    const errors = await validate(
      plainToInstance(CreatePropertyDto, {
        address: { street: 'Test', city: 'Munich', postalCode: 'abc' },
        propertyType: 'FAKE',
        sizeSqm: -1,
        condition: 'GOOD',
        yearBuilt: 2000,
        sellerContact: { name: 'Test', email: 'bad' },
        dataProcessingConsent: true,
      }),
    );
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining([
        'address',
        'propertyType',
        'sizeSqm',
        'sellerContact',
      ]),
    );
  });
});

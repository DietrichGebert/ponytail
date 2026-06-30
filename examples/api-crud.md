# API CRUD Test — Same Concept, Four Frameworks

Same API test (create, read, update, delete an account) across frameworks. Shows service layer pattern, factory data, and error assertions adapted per stack.

## Playwright (TypeScript)

```typescript
import { test, expect } from '../../support/fixtures';
import { AccountFactory } from '../../support/factories';

test.describe('Accounts API', () => {
  test('CRUD lifecycle @smoke', async ({ accountsService }) => {
    const data = AccountFactory.create({ balance: '5000' });

    await test.step('Create', async () => {
      const response = await accountsService.createAccount({ data });
      expect(response.status()).toBe(201);
      expect(response.data).toHaveProperty('id');
    });

    await test.step('Read', async () => {
      const response = await accountsService.getAccount(data.id);
      expect(response.status()).toBe(200);
      expect(response.data.balance).toBe('5000');
    });

    await test.step('Update', async () => {
      const response = await accountsService.updateAccount(data.id, { balance: '10000' });
      expect(response.status()).toBe(200);
    });

    await test.step('Delete', async () => {
      const response = await accountsService.deleteAccount(data.id);
      expect(response.status()).toBe(204);
    });
  });

  test('Create - missing fields returns 400 @regression', async ({ accountsService }) => {
    const response = await accountsService.createAccount({ data: {} });
    expect(response.status()).toBe(400);
    await expect(response).toBeApiError({ balance: 'This field is required.' });
  });
});
```

## pytest + requests (Python)

```python
import pytest
from factories import AccountFactory

class TestAccountsAPI:
    def test_crud_lifecycle(self, accounts_service):
        data = AccountFactory.create(balance='5000')

        # Create
        resp = accounts_service.create_account(data)
        assert resp.status_code == 201
        account_id = resp.json()['id']

        # Read
        resp = accounts_service.get_account(account_id)
        assert resp.status_code == 200
        assert resp.json()['balance'] == '5000'

        # Update
        resp = accounts_service.update_account(account_id, {'balance': '10000'})
        assert resp.status_code == 200

        # Delete
        resp = accounts_service.delete_account(account_id)
        assert resp.status_code == 204

    def test_create_missing_fields(self, accounts_service):
        resp = accounts_service.create_account({})
        assert resp.status_code == 400
        assert 'balance' in resp.json()['errors']
```

## Cypress (cy.request)

```javascript
describe('Accounts API', () => {
  it('CRUD lifecycle @smoke', () => {
    const data = AccountFactory.create({ balance: '5000' });

    // Create
    cy.request('POST', '/api/accounts', data).then((resp) => {
      expect(resp.status).to.eq(201);
      expect(resp.body).to.have.property('id');
      data.id = resp.body.id;
    });

    // Read
    cy.request('GET', `/api/accounts/${data.id}`).then((resp) => {
      expect(resp.status).to.eq(200);
      expect(resp.body.balance).to.eq('5000');
    });

    // Update
    cy.request('PUT', `/api/accounts/${data.id}`, { balance: '10000' }).then((resp) => {
      expect(resp.status).to.eq(200);
    });

    // Delete
    cy.request('DELETE', `/api/accounts/${data.id}`).then((resp) => {
      expect(resp.status).to.eq(204);
    });
  });

  it('Create - missing fields returns 400 @regression', () => {
    cy.request({ method: 'POST', url: '/api/accounts', body: {}, failOnStatusCode: false })
      .then((resp) => {
        expect(resp.status).to.eq(400);
        expect(resp.body.errors).to.have.property('balance');
      });
  });
});
```

## WebdriverIO (TypeScript)

```typescript
import { AccountFactory } from '../factories/account.factory';

describe('Accounts API', () => {
  const baseUrl = process.env.API_BASE_URL;

  it('CRUD lifecycle @smoke', async () => {
    const data = AccountFactory.create({ balance: '5000' });

    // Create
    const createResp = await browser.call(() =>
      fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }).then(r => ({ status: r.status, data: r.json() }))
    );
    expect(createResp.status).toBe(201);
    expect(createResp.data).toHaveProperty('id');

    // Read, Update, Delete follow same pattern...
  });
});
```

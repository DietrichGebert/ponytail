---
name: gavel-hub
description: >
  External API/Hub credentials and integration test setup. Use when integration
  tests need external API credentials, or when setting up test environments that
  connect to third-party services.
---

# Gavel Hub

External API integration test setup.

## When to Use

- Integration tests need external API base URL and credentials
- Setting up test environments for third-party service connections
- HUB_API_BASE_URL or API keys are missing from environment

## Setup

1. Check `.env` for required credentials (HUB_API_BASE_URL, HUB_API_PRIVATE_KEY)
2. If missing, ask user for credentials or use test/mock endpoints
3. Verify connectivity: `curl -H "Authorization: Bearer <key>" <base_url>/health`

## Patterns

```typescript
// Service wrapper for external API
class HubService {
  constructor(private baseUrl: string, private apiKey: string) {}

  async getSymbols(): Promise<ApiResponse> {
    return request.get(`${this.baseUrl}/symbols`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });
  }
}
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Missing env vars | Add to .env file |
| 401 from hub | Check API key validity |
| Timeout | Verify network access to hub URL |
| Tests skip | Hub credentials not configured -- expected behavior |

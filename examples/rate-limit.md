# Rate Limiting

**Task:** "Add rate limiting to my FastAPI endpoint so users can't spam it."

Verbatim model output from a benchmark run, Claude Haiku 4.5, no-skill arm vs ponytail arm, temperature 1, source `benchmarks/output.json`. Reproduce: `npx promptfoo@latest eval -c benchmarks/promptfooconfig.yaml`.

## Without Ponytail, 128 lines of code

# Rate Limiting in FastAPI

Here are several approaches, from simplest to most robust:

## 1. **Using `slowapi` (Recommended - Easiest)**

```bash
pip install slowapi
```

```python
from fastapi import FastAPI, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse

app = FastAPI()

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda request, exc: JSONResponse(
    status_code=429,
    content={"detail": "Rate limit exceeded"}
))

@app.get("/api/data")
@limiter.limit("5/minute")
async def get_data(request: Request):
    return {"message": "Success"}
```

**Rate limit formats:**
- `"5/minute"` - 5 requests per minute
- `"100/hour"` - 100 requests per hour
- `"1000/day"` - 1000 requests per day

---

## 2. **Using `limits` Library (More Control)**

```bash
pip install limits
```

```python
from fastapi import FastAPI, HTTPException, Request
from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter

app = FastAPI()

storage = MemoryStorage()
limiter = MovingWindowRateLimiter(storage)
rate_limit = parse("5/minute")

@app.get("/api/data")
async def get_data(request: Request):
    client_id = request.client.host
    
    if not limiter.hit(rate_limit, client_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    return {"message": "Success"}
```

---

## 3. **Custom Middleware (Full Control)**

```python
from fastapi import FastAPI, HTTPException, Request
from datetime import datetime, timedelta
from collections import defaultdict
import asyncio

app = FastAPI()

# Store request timestamps per IP
request_history = defaultdict(list)
RATE_LIMIT = 5  # requests
TIME_WINDOW = 60  # seconds

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    now = datetime.now()
    
    # Clean old requests outside time window
    request_history[client_ip] = [
        req_time for req_time in request_history[client_ip]
        if now - req_time < timedelta(seconds=TIME_WINDOW)
    ]
    
    # Check if limit exceeded
    if len(request_history[client_ip]) >= RATE_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded"}
        )
    
    # Record this request
    request_history[client_ip].append(now)
    
    return await call_next(request)

@app.get("/api/data")
async def get_data():
    return {"message": "Success"}
```

---

## 4. **Per-User Rate Limiting (With Authentication)**

```python
from fastapi import FastAPI, Depends, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

app = FastAPI()
limiter = Limiter(key_func=get_remote_address)

def get_user_id(token: str = Header(None)) -> str:
    # Your auth logic here
    return token or "anonymous"

@app.get("/api/data")
@limiter.limit("10/minute")
async def get_data(request: Request, user_id: str = Depends(get_user_id)):
    return {"message": f"Success for {user_id}"}
```

---

## 5. **Redis-Based Rate Limiting (Production)**

```bash
pip install slowapi redis
```

```python
from fastapi import FastAPI, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.storage import RedisStorage
from redis import Redis
from fastapi.responses import JSONResponse

redis_client = Redis.from_url("redis://localhost:6379")
storage = RedisStorage(redis_client)
limiter = Limiter(key_func=get_remote_address, storage=storage)

app = FastAPI()
app.state.limiter = limiter

app.add_exception_handler(
    RateLimitExceeded,
    lambda request, exc: JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded"}
    )
)

@app.get("/api/data")
@limiter.limit("5/minute")
async def get_data(request: Request):
    return {"message": "Success"}
```

---

## 6. **Complete Example with Multiple Endpoints**

```python
from fastapi import FastAPI, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse

app = FastAPI()
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests",
            "retry_after": exc.detail
        }
    )

# Strict limit
@app.post("/api/login")
@limiter.limit("3/minute")
async def login(request: Request):
    return {"token": "xxx"}

# Moderate limit
@app.get("/api/data")
@limiter.limit("30/minute")
async def get_data(request: Request):
    return {"data": []}

# Generous limit
@app.get("/api/public")
@limiter.limit("100/minute")
async def get_public(request: Request):
    return {"public": "data"}
```

---

## Comparison Table

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| **slowapi** | Easy, decorator-based | In-memory only | Development, small apps |
| **limits** | Flexible, multiple backends | More setup | Custom logic |
| **Middleware** | Full control, no dependencies | Manual cleanup | Learning, simple cases |
| **Redis** | Distributed, scalable | Requires Redis | Production, multi-server |

---

## Testing Rate Limits

```python
import httpx

async def test_rate_limit():
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        for i in range(6):
            response = await client.get("/api/data")
            print(f"Request {i+1}: {response.status_code}")
            # First 5 should be 200, 6th should be 429
```

**Recommendation:** Use `slowapi` for most cases, it's the most popular and easiest to implement! 🚀

## With Ponytail, 10 lines of code

```python
from fastapi import FastAPI, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

app = FastAPI()
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/api/endpoint")
@limiter.limit("10/minute")
async def my_endpoint(request):
    return {"status": "ok"}
```

Skipped: custom rate limit logic, Redis, sliding windows, `slowapi` handles it. Add when: you need distributed rate limiting across multiple servers (swap `Limiter` for Redis backend) or per-user limits (add `key_func=lambda r: r.headers.get("authorization")`).

**128 → 10 lines of code**, same model, same prompt.

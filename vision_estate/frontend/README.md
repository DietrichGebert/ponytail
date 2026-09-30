# Frontend

Next.js 16 / React 19 portal. Run `npm ci`, then `npm run dev`. Server-only `API_INTERNAL_URL` defaults to http://127.0.0.1:3001. Browser requests use the same-origin /api proxy.

Routes: /, /valuation/start, /valuation/report/[id], /broker/login, /broker/leads, /broker/bookings and /admin.

Run `npm run build` and `npm run lint`. Follow [root setup](../README.md) for the database and backend. See [review status](../docs/REVIEW-AND-ROADMAP.md) for remaining production work.

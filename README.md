# Throttle — Distributed Rate Limiter

A working, end-to-end distributed rate limiter: pick an algorithm, define a rule,
throw traffic at it, and watch requests get allowed or blocked in real time.
Now with multi-tenancy, an API Gateway mode, Prometheus/Grafana observability,
and CI/CD to GHCR.

> **Scope note:** what's here is fully wired — real algorithms against real
> Redis, real Mongo-backed logs and analytics, a real Clerk-gated admin UI
> with RBAC, Docker Compose, Kubernetes manifests, CI/CD, and Prometheus/
> Grafana. Deliberately still out of scope: JWT-based auth as an alternative
> to Clerk, a dedicated bulk admin panel (CSV/PDF export, bulk user
> management), command palette, and dark/light mode toggle — see
> [Roadmap](#roadmap).

---

## Architecture

```
┌─────────────┐        REST + WebSocket        ┌──────────────┐        ┌─────────────┐
│  React SPA  │ ─────────────────────────────▶ │   Express    │ ─────▶ │  Prometheus │
│ (Vite/Tail- │ ◀───────────────────────────── │   API        │        │  + Grafana  │
│  wind/Clerk)│         Socket.io live feed     │              │        └─────────────┘
└─────────────┘                                 └──────┬───────┘
                                                         │
                                   ┌─────────────────────┼─────────────────────┐
                                   ▼                     ▼                     ▼
                             ┌──────────┐          ┌──────────┐         ┌──────────┐
                             │  Redis   │          │ MongoDB  │         │  Clerk   │
                             │ counters │          │ rules /  │         │  auth    │
                             │ / tokens │          │ logs     │         │          │
                             └──────────┘          └──────────┘         └──────────┘
```

**Request flow:** every request to `/api/demo/*` (or `/gateway/*` in API
Gateway mode) passes through the `rateLimiter` middleware, which (1) resolves
`req.tenantId` from an `X-Tenant-Id` header (defaults to `"default"`),
(2) matches the request path against the highest-priority enabled rule *for
that tenant*, (3) resolves a client identifier (IP, user ID, API key, or JWT —
configurable per rule), (4) runs the rule's algorithm against Redis,
(5) writes an async log to MongoDB and a Prometheus metric, and (6) emits a
live event over Socket.io. If it's blocked, the client gets a `429`. If Redis
errors, the middleware **fails open** — a cache hiccup shouldn't take down
the whole API.

## Algorithms implemented

| Algorithm | File | Behavior |
|---|---|---|
| Fixed Window | `backend/algorithms/fixedWindow.js` | Simple per-window counter. Cheapest, but allows bursts at window edges. |
| Sliding Window Counter | `backend/algorithms/slidingWindowCounter.js` | Weights the previous window's count by overlap — smooths the edge-burst problem without storing every timestamp. |
| Token Bucket | `backend/algorithms/tokenBucket.js` | Bucket refills continuously at `limit / windowSeconds` tokens/sec, up to a `burst` capacity. Allows bursts up to capacity, then throttles to the steady rate. |
| Leaky Bucket | `backend/algorithms/leakyBucket.js` | Bucket "leaks" (drains) continuously at a constant rate; each request adds one unit. Enforces a strictly smooth output rate — no bursts allowed, even if the bucket has headroom. Use this when a downstream system needs steady, predictable load rather than permission for occasional spikes. |

Token Bucket and Leaky Bucket are both implemented as atomic Lua scripts
(`EVALSHA`) so concurrent requests can't race the same counter. Rules pick
their algorithm dynamically — no code change needed to switch.

## Multi-tenancy

Every rule, log entry, and API key is scoped to a `tenantId` (defaults to
`"default"` for single-tenant deployments — nothing changes if you never set
it). To rate-limit as a specific tenant, send `X-Tenant-Id: <tenant>` on the
request. Rules only match requests from their own tenant, so two tenants can
have wildly different limits on the same endpoint pattern without
interfering with each other. The Rules and Logs pages both expose a Tenant
column/filter.

```bash
# Tenant "acme" gets its own independent counters, even hitting the same path:
curl -H "X-Tenant-Id: acme" http://localhost:4000/api/demo/ping
curl -H "X-Tenant-Id: globex" http://localhost:4000/api/demo/ping
```

## API Gateway mode

Any rule can carry an `upstreamUrl`. Requests to `/gateway/<path>` are rate
limited exactly like `/api/demo/*`, but on success are reverse-proxied to
that upstream instead of hitting a local demo route — so Throttle can sit in
front of a real internal service and rate-limit traffic before it ever
reaches it.

1. Create a rule with **Endpoint pattern**: `/gateway/orders/*` and
   **Upstream URL**: `https://internal-orders-service.example.com`
2. Traffic to `http://localhost:4000/gateway/orders/123` is rate-limited,
   then proxied to `https://internal-orders-service.example.com/orders/123`
   (the `/gateway` prefix is stripped before forwarding)

## Observability: Prometheus + Grafana

`GET /metrics` exposes Prometheus-format metrics: `throttle_requests_total`
(labeled by `tenant`, `algorithm`, `status`), `throttle_request_duration_ms`
(a histogram), plus default Node.js process metrics. `docker compose up`
starts Prometheus (`:9090`, scraping the backend automatically) and Grafana
(`:3001`, default login `admin` / `admin` unless you set
`GRAFANA_ADMIN_PASSWORD`) with a starter dashboard already provisioned —
open Grafana and the **Throttle - Rate Limiter** dashboard is there with no
extra setup, showing request rate by status, p95 decision latency, and a
block-rate stat panel.

## Tech stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), Redis (ioredis), Socket.io, Zod validation, Clerk auth, prom-client, http-proxy-middleware
- **Frontend:** React 19, Vite, Tailwind CSS, TanStack Query, Recharts, Framer Motion, Clerk React
- **DevOps:** Docker, Docker Compose, Kubernetes manifests, GitHub Actions (test → build → publish to GHCR), Nginx (frontend prod image), Prometheus, Grafana

---

## Getting started

### 1. Prerequisites
- Node.js 20+
- MongoDB and Redis (locally, or just use Docker Compose — see below)
- A free [Clerk](https://clerk.com) application (for auth)

### 2. Clerk setup
1. Create an application at the Clerk dashboard.
2. Copy your **Publishable key** and **Secret key**.
3. In **Users → (your user) → Public metadata**, set:
   ```json
   { "role": "admin" }
   ```
   Rules and analytics routes require this role — this is the app's RBAC.

### 3. Environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in `CLERK_SECRET_KEY` (backend) and `VITE_CLERK_PUBLISHABLE_KEY` (frontend).
See [Environment variables](#environment-variables) below for the full list.

### 4. Run with Docker Compose (recommended)

```bash
export CLERK_SECRET_KEY=sk_test_xxx
export CLERK_PUBLISHABLE_KEY=pk_test_xxx
docker compose up --build
```

- Frontend: http://localhost:8080
- Backend API: http://localhost:4000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (login `admin` / `admin` unless `GRAFANA_ADMIN_PASSWORD` is set)

### 5. Run locally without Docker

```bash
# Terminal 1
cd backend && npm install && npm run dev

# Terminal 2
cd frontend && npm install && npm run dev
```

Frontend dev server runs at http://localhost:5173 and proxies `/api` to
`localhost:4000` (see `frontend/vite.config.js`).

### 6. Try it out
1. Sign in, go to **Rules**, create a rule (e.g. limit `10` requests per `60`
   seconds on `/api/demo/*`, identified by IP, using Token Bucket).
2. Hit the demo endpoint repeatedly: `curl http://localhost:4000/api/demo/ping`
   (loop it — `for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" localhost:4000/api/demo/ping; done`)
3. Watch the **Dashboard** — the live feed, charts, and stat cards update in
   real time as requests get allowed/blocked.

---

## Environment variables

**backend/.env**
| Variable | Description |
|---|---|
| `PORT` | API port (default `4000`) |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `CORS_ORIGIN` | Allowed frontend origin |
| `CLERK_SECRET_KEY` | Clerk backend secret key |
| `ADMIN_BYPASS_IDS` | Comma-separated Clerk user IDs exempt from rate limiting |

**root `.env`** (used by `docker compose up` only)
| Variable | Description |
|---|---|
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` | Same Clerk keys, exported for Compose to inject into both services |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password (default `admin` if unset — change this before exposing Grafana publicly) |

**frontend/.env**
| Variable | Description |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend publishable key |
| `VITE_SOCKET_URL` | Socket.io server URL (default `http://localhost:4000`) |

---

## API documentation

All `/api/rules`, `/api/keys`, `/api/analytics` routes require a Clerk
session (`Authorization: Bearer <token>`); rules and analytics additionally
require `publicMetadata.role === "admin"`. Any authenticated request may
send `X-Tenant-Id: <tenant>` to scope rule matching/logging to a specific
tenant (defaults to `"default"`).

### Identity
| Method | Path | Description |
|---|---|---|
| GET | `/api/me` | Current user's `{ userId, role }` — used by the frontend for RBAC gating |

### Rules
| Method | Path | Description |
|---|---|---|
| GET | `/api/rules` | List all rules (across all tenants) |
| POST | `/api/rules` | Create a rule (accepts `tenantId`, `upstreamUrl` for gateway mode) |
| PATCH | `/api/rules/:id` | Update a rule |
| DELETE | `/api/rules/:id` | Delete a rule |
| PATCH | `/api/rules/:id/toggle` | Enable/disable a rule |

### API keys
| Method | Path | Description |
|---|---|---|
| GET | `/api/keys` | List your API keys (hash never returned) |
| POST | `/api/keys` | Generate a new key (raw key shown once) |
| POST | `/api/keys/:id/revoke` | Revoke a key |

### Analytics
| Method | Path | Description |
|---|---|---|
| GET | `/api/analytics/summary` | Totals, success/block rate, RPS, avg latency (24h) |
| GET | `/api/analytics/timeseries?hours=24` | Hourly allowed/blocked counts |
| GET | `/api/analytics/algorithm-usage` | Request counts by algorithm |
| GET | `/api/analytics/top-clients` | Top clients + most-blocked clients |
| GET | `/api/analytics/top-endpoints` | Most-requested endpoints |
| GET | `/api/analytics/logs?clientId=&endpoint=&status=&algorithm=&tenantId=&page=&limit=` | Paginated, filterable request log |

### Demo (rate-limited traffic to test against)
| Method | Path |
|---|---|
| GET | `/api/demo/ping` |
| GET | `/api/demo/orders` |
| POST | `/api/demo/orders` |

### Gateway (rate-limited + reverse-proxied)
| Method | Path | Description |
|---|---|---|
| ANY | `/gateway/*` | Rate-limited per the matching rule; proxied to that rule's `upstreamUrl` if set, else `404 no_upstream_configured` |

### Observability
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check, no auth |
| GET | `/metrics` | Prometheus scrape target, no auth (restrict at the network/ingress layer in production) |

### Live updates
Socket.io emits a `request` event on every rate-limited request:
```json
{ "tenantId": "default", "clientId": "...", "endpoint": "/api/demo/ping", "status": "allowed", "algorithm": "token_bucket", "timestamp": 1719999999000 }
```

---

## Testing

```bash
cd backend && npm test
```

Unit tests cover the Fixed Window and Sliding Window Counter algorithms
against an in-memory fake Redis (no live Redis needed). Token Bucket and
Leaky Bucket both use Lua scripts (`EVALSHA`) and are best verified against
real Redis — exercise them via the demo endpoints in `docker compose up`.

---

## Deployment guide

### Option A — CI/CD to GHCR (recommended)
`.github/workflows/ci.yml` runs tests → lint → build on every push/PR, and
on pushes to `main` additionally builds and publishes both images to GitHub
Container Registry (`ghcr.io/<your-repo>/backend` and `.../frontend`) —
nothing to configure beyond adding a `VITE_CLERK_PUBLISHABLE_KEY` repository
secret (Settings → Secrets and variables → Actions). From there, point any
container platform (Kubernetes, ECS, Fly.io, Render) at the published image.

### Option B — Kubernetes
See [`k8s/README.md`](./k8s/README.md) for manifests covering the full
stack (backend, frontend, Redis, Mongo, ingress, HPA). Starter-grade — swap
the bundled Redis/Mongo Deployments for managed services before real
production traffic.

### Option C — Manual container deploy
1. Provision managed MongoDB (Atlas) and Redis (Upstash/ElastiCache).
2. Build and push images:
   ```bash
   docker build -t <registry>/rate-limiter-backend ./backend
   docker build -t <registry>/rate-limiter-frontend \
     --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx ./frontend
   ```
3. Deploy the backend anywhere that runs a container (Fly.io, ECS, Render,
   Railway) with the env vars from above pointed at your managed services.
4. Deploy the frontend image (or `frontend/dist` as a static site) behind
   your CDN/edge of choice, with `/api` and `/socket.io` proxied to the
   backend (see `frontend/nginx.conf` for a working example).
5. Point `CORS_ORIGIN` (backend) at your deployed frontend origin.
6. If you want metrics in production, point your existing Prometheus at
   `GET /metrics` (restrict network access to it — it's unauthenticated by
   Prometheus convention) and import `ops/grafana/provisioning/dashboards/json/throttle.json`
   into your Grafana instance.

---

## Roadmap

Deliberately still out of scope, in priority order:
- Sliding Window Log algorithm (Sliding Window Counter is implemented; the
  timestamp-log variant is not)
- JWT-based auth as an alternative to Clerk
- Dedicated bulk Admin Panel (bulk user management, reset counters, CSV/PDF
  analytics export)
- WebSocket-driven "active users" gauge as its own metric (currently: live
  feed + polling + the delta-merge on Dashboard stat cards)
- Heatmap traffic view
- OpenAPI/Swagger spec
- True distributed Redis (cluster/sentinel) — current setup assumes a
  single Redis instance/managed endpoint
- Command palette, dark/light mode toggle, email notifications
- Per-tenant analytics dashboards (tenant filtering exists on Logs; the
  Dashboard's charts are still global across tenants)

## Future improvements

- Add integration tests for Token Bucket and Leaky Bucket against a real
  Redis (testcontainers)
- Rule versioning/audit log
- Per-rule analytics breakdown (right now analytics are global)
- Horizontal scaling notes for the Socket.io layer (Redis adapter for
  multi-instance — matters once you run more than one backend replica, since
  right now each instance's Socket.io clients only see that instance's
  events)
- NetworkPolicies / PodDisruptionBudgets for the Kubernetes manifests
- ServiceMonitor CRD for clusters running the Prometheus Operator, instead
  of the bundled Prometheus/Grafana containers

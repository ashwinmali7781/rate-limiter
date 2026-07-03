# Kubernetes manifests (optional, starter-grade)

These get the full Throttle stack running on any cluster, but they're a
starting point, not a hardened production setup. In particular:

- `mongo` and `redis` are single-pod Deployments with a PVC. Fine for a
  demo or staging cluster. For real production traffic, use managed
  MongoDB (Atlas) and Redis (ElastiCache/Upstash/Memorystore) instead, and
  delete `02-redis.yaml` / `03-mongo.yaml`, pointing `throttle-config`'s
  `MONGO_URI` / `REDIS_URL` at your managed instances.
- No NetworkPolicies, PodDisruptionBudgets, or resource quotas beyond basic
  requests/limits - add these based on your cluster's actual constraints.
- The backend is horizontally scalable out of the box (rate limit state
  lives in Redis, not in-process), so the HPA in `04-backend.yaml` is safe
  to tune more aggressively if needed.

## Apply order

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl create secret generic throttle-secrets \
  --namespace throttle \
  --from-literal=CLERK_SECRET_KEY=sk_live_xxx
kubectl apply -f k8s/01-config.yaml
kubectl apply -f k8s/02-redis.yaml
kubectl apply -f k8s/03-mongo.yaml
kubectl apply -f k8s/04-backend.yaml
kubectl apply -f k8s/05-frontend.yaml
kubectl apply -f k8s/06-ingress.yaml
```

Before applying, replace every `ghcr.io/YOUR_ORG/YOUR_REPO` image reference
in `04-backend.yaml` and `05-frontend.yaml` with your actual published
image (see the CI workflow in `.github/workflows/ci.yml`, which publishes
to GHCR automatically on pushes to `main`), and replace
`your-domain.example.com` in `06-ingress.yaml` with your real domain.

## Observability on k8s

Prometheus/Grafana aren't included here since most clusters already run a
shared observability stack (kube-prometheus-stack, etc.). Point your
existing Prometheus at the backend Service using a ServiceMonitor or a
scrape annotation on `04-backend.yaml`'s pod template:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "4000"
    prometheus.io/path: "/metrics"
```

If you don't have a shared stack, the `docker-compose.yml` Prometheus +
Grafana services (`ops/`) can be ported into the cluster as their own
Deployments the same way `04-backend.yaml` is structured.

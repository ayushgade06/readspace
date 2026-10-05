# ReadSpace — PICT Reading Hall

Seat occupancy system for the PICT reading hall. The web page shows the hall as a floor plan; a seat can be occupied or released with one click, and the counts update for everyone.

Built for the TY B.Tech IT course *DevOps for Scalable Systems* (Group Classroom CIE-01). The application is kept small on purpose. The point of the project is the pipeline around it:

```
Git  ->  GitHub Actions  ->  Docker  ->  Kubernetes  ->  Prometheus  ->  Grafana
```

## Features

- Floor plan of the reading hall with 8 tables and 48 numbered seats
- Occupy an available seat, release an occupied seat
- Live counts: total, occupied, available, occupancy percentage
- Recent activity list
- Clear messages for errors (seat already occupied, backend unavailable, ...)
- `/health` endpoint for Kubernetes probes
- `/metrics` endpoint for Prometheus, with a ready-made Grafana dashboard

## Architecture

```
                 Browser
                    |
                    v
   +---------------------------------+
   |  ReadSpace container (port 4000) |
   |  Express API + React frontend    |-----> PostgreSQL
   |  /api/*   /health   /metrics     |       (seats, activity)
   +---------------------------------+
                    ^
                    |  scrapes /metrics every 5 s
               Prometheus
                    ^
                    |  PromQL queries
                 Grafana
```

How a change travels through the project:

1. A developer changes the code and commits it with **Git**.
2. The push starts **GitHub Actions**, which runs the tests and builds the application.
3. The pipeline builds the **Docker** image and checks that a container started from it answers requests.
4. **Kubernetes** runs that image as a Deployment with several replicas behind a Service.
5. Every replica exposes `/metrics`. **Prometheus** scrapes it.
6. **Grafana** reads from Prometheus and draws the dashboard.

## Tech stack

| Part             | Technology                              |
|------------------|-----------------------------------------|
| Frontend         | React, TypeScript, Vite                 |
| Backend          | Node.js 22, Express, TypeScript         |
| Database         | PostgreSQL 16                           |
| Tests            | Vitest, Supertest                       |
| Containerization | Docker, Docker Compose                  |
| CI/CD            | GitHub Actions                          |
| Orchestration    | Kubernetes (Docker Desktop)             |
| Monitoring       | Prometheus, Grafana                     |

## Repository structure

```
.
├── backend/               Express API (TypeScript)
│   ├── src/
│   │   ├── server.ts      starts the server
│   │   ├── app.ts         routes, logging, error handling
│   │   ├── seats.ts       database queries
│   │   ├── db.ts          connection pool, schema + seed at startup
│   │   ├── metrics.ts     Prometheus metrics
│   │   └── config.ts      environment variables
│   └── tests/             API tests
├── frontend/              React application
│   └── src/
│       ├── App.tsx
│       ├── api.ts         calls to the REST API
│       └── components/    FloorPlan, SummaryBar, ActivityList
├── database/              schema.sql, seed.sql
├── k8s/                   Kubernetes manifests
├── monitoring/
│   ├── prometheus/        prometheus.yml (Compose), prometheus.k8s.yml (Kubernetes)
│   └── grafana/           data source, dashboard provider, dashboard JSON
├── scripts/
│   ├── k8s-deploy.ps1     deploys everything to Kubernetes
│   ├── k8s-port-forward.ps1  local ports for clusters without NodePort access
│   └── simulate.mjs       generates real activity for the monitoring demo
├── .github/workflows/     ci.yml
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── DEMO.md                8-10 minute demo script
└── VIVA_NOTES.md          short notes for each tool
```

## Requirements

- Git
- Node.js 22
- Docker Desktop, with Kubernetes enabled (Settings > Kubernetes > Enable Kubernetes)

No cloud account is needed. Everything runs on one laptop.

## Environment configuration

```
cp .env.example .env
```

Open `.env` and replace both `change-me` values with passwords of your choice. `.env` is ignored by git.

| Variable | Meaning |
|----------|---------|
| `PORT` | Port the API listens on (4000) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` | Grafana admin login |
| `APP_PORT`, `DB_HOST_PORT`, `PROMETHEUS_PORT`, `GRAFANA_PORT` | Host ports used by Docker Compose. Change one if that port is already in use on your machine. |

The application stops at startup with a clear message if a required `DB_*` variable is missing.

## Database setup

The database has two tables:

| Table | Columns |
|-------|---------|
| `seats` | `id`, `seat_number`, `section`, `status` (`available` / `occupied`), `updated_at` |
| `activity` | `id`, `seat_id`, `action` (`occupy` / `release`), `created_at` |

There is nothing to run by hand. At startup the API executes `database/schema.sql` and `database/seed.sql`. Both are safe to run repeatedly. The seed inserts 48 seats (Table A to Table H, 6 seats each). The application does not assume 48 anywhere: totals and the floor plan come from the `seats` table.

## Running locally

```
docker compose up -d db          # PostgreSQL on localhost:5433

cd backend
npm install
npm run dev                      # API on http://localhost:4000

cd frontend                      # in a second terminal
npm install
npm run dev                      # page on http://localhost:5173
```

Run the tests (they need the database, and they reset all seats to available):

```
cd backend
npm test
```

### API

| Method | Path | Result |
|--------|------|--------|
| GET | `/api/seats` | all seats |
| GET | `/api/stats` | `{ total, occupied, available, occupancyPercentage }` |
| GET | `/api/activity` | last 20 actions |
| POST | `/api/seats/:id/occupy` | 200, or 409 if already occupied |
| POST | `/api/seats/:id/release` | 200, or 409 if already available |
| GET | `/health` | 200 when the database is reachable, otherwise 503 |
| GET | `/metrics` | Prometheus metrics |

Other status codes: 400 for an invalid seat id, 404 for an unknown seat, 503 when the database is down.

## Docker setup

Build and run the image on its own (the database from the previous step must be running):

```
docker build -t readspace:1.0 .
docker images readspace

docker run -d --name readspace -p 4000:4000 --env-file .env -e DB_HOST=host.docker.internal readspace:1.0

docker ps
docker logs readspace
```

Open http://localhost:4000. Remove the container with `docker rm -f readspace`.

The port is the same everywhere: the application listens on 4000, the Dockerfile has `EXPOSE 4000`, and `-p 4000:4000` maps host port 4000 to container port 4000.

Or start the complete stack with Docker Compose:

```
docker compose up -d --build
docker compose ps
```

| Service | URL |
|---------|-----|
| ReadSpace | http://localhost:4000 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3000 |

Stop it with `docker compose down` (add `-v` to delete the database volume as well).

## GitHub Actions

Workflow: `.github/workflows/ci.yml`. It runs on every push and on pull requests into `main`.

| Job | What it does |
|-----|--------------|
| Test | Checkout, install backend dependencies, run the API tests against a PostgreSQL service container |
| Build | Compile the backend, build the frontend |
| Docker build and validation | Build the image, check the Prometheus configuration with `promtool`, start the containers and request `/health`, `/api/stats`, `/metrics` and the web page |

The Docker job runs only if Test and Build pass. Results are under the **Actions** tab of the repository.

## Kubernetes deployment

Build the image first, then run the deploy script from the repository root:

```
docker build -t readspace:1.0 .
powershell -ExecutionPolicy Bypass -File scripts\k8s-deploy.ps1
```

The script runs plain `kubectl` commands: it creates the Secrets from `.env`, creates ConfigMaps from the files in `monitoring/`, starts the database, and then applies everything in `k8s/`.

| File | Objects |
|------|---------|
| `k8s/deployment.yaml` | Deployment `readspace` (2 replicas, readiness and liveness probes) |
| `k8s/service.yaml` | Service `readspace` (NodePort 30080) and headless Service `readspace-pods` |
| `k8s/postgres.yaml` | PersistentVolumeClaim, Deployment and Service for PostgreSQL |
| `k8s/prometheus.yaml` | Deployment and Service for Prometheus (NodePort 30090) |
| `k8s/grafana.yaml` | Deployment and Service for Grafana (NodePort 30030) |

| Service | URL |
|---------|-----|
| ReadSpace | http://localhost:30080 |
| Prometheus | http://localhost:30090 |
| Grafana | http://localhost:30030 |

These URLs work directly when the Docker Desktop cluster uses the **kubeadm** provisioner (Settings > Kubernetes > Cluster provisioning). With the **kind** provisioner or Minikube, NodePorts are not published on `localhost`. In that case keep this running in a second terminal, and the same URLs work:

```
powershell -ExecutionPolicy Bypass -File scriptsk8s-port-forward.ps1
```

Port chain for the application: `localhost:30080` (nodePort) -> Service port `80` -> `targetPort 4000` -> `containerPort 4000`.

Useful commands:

```
kubectl get pods
kubectl get deployments
kubectl get services
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl get events --sort-by=.lastTimestamp

kubectl scale deployment readspace --replicas=1
kubectl scale deployment readspace --replicas=2
```

All replicas use the same database, so the page shows the same seats no matter which pod answers.

Remove everything:

```
kubectl delete -f k8s
kubectl delete configmap prometheus-config grafana-datasources grafana-dashboard-provider grafana-dashboards
kubectl delete secret readspace-db readspace-grafana
```

## Prometheus

The application exposes these metrics at `/metrics`:

| Metric | Type | Meaning |
|--------|------|---------|
| `reading_hall_seats_total` | gauge | seats in the hall |
| `reading_hall_seats_occupied` | gauge | seats in use |
| `reading_hall_seats_available` | gauge | free seats |
| `reading_hall_occupancy_ratio` | gauge | occupied / total, between 0 and 1 |
| `reading_hall_occupy_actions_total` | counter | successful occupy actions |
| `reading_hall_release_actions_total` | counter | successful release actions |
| `http_requests_total` | counter | API requests by `method`, `route`, `status` |
| `http_request_duration_seconds` | histogram | API response time by `method`, `route` |

The seat gauges are read from the database on every scrape. The HTTP metrics cover `/api/*` only, so probe and scrape requests do not hide user traffic.

Configuration:

- `monitoring/prometheus/prometheus.yml` (Compose): one static target, `app:4000`.
- `monitoring/prometheus/prometheus.k8s.yml` (Kubernetes): looks up the headless Service `readspace-pods`, which returns one address per pod, so every replica is a separate target.

Check that scraping works: open Prometheus, then **Status > Target health**. The `readspace` job must be **UP**.

Queries to try on the **Query** page:

```
reading_hall_seats_occupied
reading_hall_seats_available
reading_hall_occupancy_ratio
rate(http_requests_total[1m])
sum by (status) (rate(http_requests_total[1m]))
up{job="readspace"}
```

## Grafana

Grafana starts with the Prometheus data source and the dashboard **ReadSpace - PICT Reading Hall** already loaded from `monitoring/grafana/`. The dashboard opens without logging in; the admin login from `.env` is only needed to edit.

| Panel | Query |
|-------|-------|
| Occupancy | `max(reading_hall_occupancy_ratio)` |
| Occupied Seats | `max(reading_hall_seats_occupied)` |
| Available Seats | `max(reading_hall_seats_available)` |
| Total Seats | `max(reading_hall_seats_total)` |
| HTTP Requests Over Time | `sum by (status) (rate(http_requests_total[1m]))` |
| Occupy vs Release Actions | `sum(increase(reading_hall_occupy_actions_total[1m]))` and the same for release |
| API Response Time | average and 95th percentile from `http_request_duration_seconds` |

`max(...)` is used for the seat panels because every replica reports the same value from the shared database. `sum(...)` is used for requests because each replica counts only its own.

### Showing an anomaly

`scripts/simulate.mjs` sends real requests to the API. Watch the dashboard while it runs.

```
node scripts/simulate.mjs rush      # occupies every free seat: occupancy climbs to 100 %
node scripts/simulate.mjs errors    # rejected requests: 404 and 409 lines appear
node scripts/simulate.mjs clear     # releases every seat: occupancy drops to 0 %
```

The default address is the Kubernetes one (`http://localhost:30080`). For Compose add the address: `node scripts/simulate.mjs rush http://localhost:4000`.

## Troubleshooting

| Problem | What to check |
|---------|---------------|
| **A. Push does not start the pipeline** | Is the file in `.github/workflows/` on the pushed branch? Is the YAML valid (Actions tab shows a workflow error)? Does the `on:` section include this branch or event? Was the push made to the right repository (`git remote -v`)? Are Actions enabled in the repository settings? |
| **B. Pipeline fails** | Open the run in the Actions tab and find the first red job and step. Test job: read the failing test name and the expected/received values. Build job: read the TypeScript error and line. Install step: `package-lock.json` out of sync with `package.json`. Docker job: read the build output and the "Show container logs" step. Reproduce locally with `npm test`, `npm run build`, `docker build`. |
| **C. Container runs but the page does not open** | `docker ps`: is there a mapping `0.0.0.0:4000->4000/tcp`? A mapping such as `4000->3000` points at a port nothing listens on. `docker logs readspace`: does it say "listening on port 4000"? Does the app bind to `0.0.0.0` (see `server.ts`)? Is another program already using host port 4000? |
| **D. Pod is in CrashLoopBackOff** | `kubectl get pods`, then `kubectl logs <pod> --previous` for the reason the container exited (missing variable, database not reachable). `kubectl describe pod <pod>` for the exit code, restart count and events. Check the `env` section of `k8s/deployment.yaml` and that the Secret exists (`kubectl get secret readspace-db`). |
| **Pod is Running but not Ready** | `kubectl describe pod <pod>` shows "Readiness probe failed". `/health` returns 503 when the database is unreachable: check `kubectl get pods -l app=postgres` and the `DB_HOST` value. |
| **Pods are Ready but the page does not open** | `kubectl get service readspace`: type NodePort, `80:30080`. `kubectl get endpoints readspace`: must list pod IPs with port 4000. An empty list means the Service selector does not match the pod labels; a wrong port means `targetPort` does not match `containerPort`. If everything matches and `localhost:30080` still does not answer, the cluster does not publish NodePorts: run `scriptsk8s-port-forward.ps1`. |
| **ImagePullBackOff** | The image `readspace:1.0` is not in the local image store. Run `docker build -t readspace:1.0 .` and check `docker images readspace`. |
| **E. Prometheus target is DOWN** | Target health page shows the error text. Open the application's `/metrics` in the browser. Check the target address and port in the Prometheus configuration against the Service or Compose service name. In Kubernetes: `kubectl get endpoints readspace-pods` and `kubectl logs deployment/prometheus`. |
| **F. Grafana shows no data** | Connections > Data sources > Prometheus: does the URL `http://prometheus:9090` answer? Is the time range "Last 15 minutes" and not a period before the system started? Run the panel's query on the Prometheus Query page: no result there means the metric is missing or the target is down. The request panels stay empty until the API has received requests. |

Each of these can be produced on purpose for practice; the steps are in [DEMO.md](DEMO.md).


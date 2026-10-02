# Ayush — Docker (Containerization Owner)

Also yours: the six-sentence integration walkthrough, Grafana in the integration slot (shared with Aarya), and troubleshooting scenarios C (container runs but application is inaccessible) and F (Grafana shows no data) together with Aarya.

Read [README.md](README.md) first for the group part.

## Your 9 marks (rubric 4.3)

| Criterion | Marks | Expected evidence | What you do |
|-----------|-------|-------------------|-------------|
| Dockerfile | 3 | Explain FROM, COPY, RUN and CMD/ENTRYPOINT | Walk through our `Dockerfile` |
| Image | 3 | Build, tag and verify an image | `docker build -t readspace:1.0 .` and `docker images readspace` |
| Container execution | 3 | Run, inspect and access a container using appropriate ports | `docker run -p`, `docker ps`, `docker logs`, open the page |

## What you need to understand

**Image and container**

- *Image*: a read-only package with the application and everything it needs (Node.js, libraries, our code). Built once.
- *Container*: a running instance of an image, isolated from the rest of the machine. One image can start many containers.
- *Container vs virtual machine*: a VM carries a whole operating system. A container shares the host's kernel, so it starts in a second and is much smaller.
- *Tag*: the version label after the colon. `readspace:1.0` is image `readspace`, tag `1.0`.

**Our Dockerfile, line by line**

```dockerfile
FROM node:22-alpine AS frontend-build      # stage 1 starts from the official Node 22 image
WORKDIR /app/frontend                      # directory for the following commands
COPY frontend/package*.json ./             # copy only the dependency list first
RUN npm ci                                 # install dependencies (build time)
COPY frontend/ ./                          # copy the source code
RUN npm run build                          # produce static files in dist/

FROM node:22-alpine AS backend-build       # stage 2: compile TypeScript to JavaScript
...same pattern for backend/...

FROM node:22-alpine                        # stage 3: the image that actually runs
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev                      # runtime dependencies only
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
COPY database/ /app/database/
USER node                                  # do not run as root
EXPOSE 4000                                # documents the port
CMD ["node", "dist/server.js"]             # command executed when a container starts
```

| Instruction | Meaning | When it runs |
|-------------|---------|--------------|
| `FROM` | The base image to start from | build |
| `WORKDIR` | Sets the working directory inside the image | build |
| `COPY` | Copies files from the project (or from another stage) into the image | build |
| `RUN` | Executes a command and saves the result as a layer | build |
| `ENV` | Sets an environment variable | build and run |
| `USER` | The user the container runs as | run |
| `EXPOSE` | Documents which port the application listens on. It does **not** open the port. | documentation |
| `CMD` | The default command when a container starts | run |

- **`RUN` vs `CMD`**: `RUN` happens while building the image. `CMD` happens every time a container starts.
- **`CMD` vs `ENTRYPOINT`**: both define what starts. `CMD` can be replaced on the `docker run` command line. `ENTRYPOINT` stays fixed, and `CMD` then supplies its default arguments.
- **Multi-stage build**: stages 1 and 2 need compilers and development packages. Stage 3 copies only their results with `COPY --from=`. The final image has no TypeScript compiler and no source code, so it is smaller and has less in it that could be attacked.
- **Layers and caching**: every instruction creates a layer, and unchanged layers are reused. That is why `package*.json` is copied and `npm ci` is run **before** the source code is copied: a code change does not repeat the slow install.
- **`.dockerignore`**: keeps `node_modules`, `.git`, `.env` and other unneeded files out of the build. The `.env` line matters: passwords must not end up inside the image.

**Ports**

Three places must agree, and in our project they are all 4000:

1. the application listens on `PORT=4000`, bound to `0.0.0.0` (see `backend/src/server.ts`)
2. `EXPOSE 4000` in the Dockerfile
3. the **container** side of `-p host:container`

`-p 4001:4000` means: host port 4001 -> container port 4000. If the application bound to `127.0.0.1` instead of `0.0.0.0`, it would accept connections only from inside the container, and the mapping would not help.

**Configuration**

The image contains no passwords. Settings are passed at start: `--env-file .env` gives the container the variables from `.env`. `-e DB_HOST=host.docker.internal` replaces one of them: inside a container `localhost` is the container itself, and `host.docker.internal` is the laptop, where the Compose database is published on port 5433.

**Docker Compose**

`docker-compose.yml` describes several containers together: `db`, `app`, `prometheus`, `grafana`. Inside the Compose network they reach each other by service name (`db:5432`, `app:4000`). `docker compose up -d --build` starts all of them. Kubernetes does the same job for the real deployment.

## Your demo (70-90 seconds)

Have ready: `Dockerfile` open in the editor and a terminal in the repository root. The Compose database must be running (`docker compose up -d db`, part of the setup).

**1. Dockerfile** (25 s). Point at `FROM`, `COPY`, `RUN`, `EXPOSE 4000`, `CMD`, one phrase each. Say: "Three stages. The first two build, the last one only runs."

**2. Build, tag, verify** (15 s)

```
docker build -t readspace:1.0 .
docker images readspace
```

Point at: `readspace` with tag `1.0`. Say: "`-t` gives the image its name and tag. The build is fast now because every layer is cached."

**3. Run** (10 s)

```
docker run -d --name readspace-demo -p 4001:4000 --env-file .env -e DB_HOST=host.docker.internal readspace:1.0
```

Say: "`-d` runs it in the background, `-p` maps host port 4001 to container port 4000."

**4. Inspect** (20 s)

```
docker ps --filter name=readspace-demo
docker logs readspace-demo
docker port readspace-demo
```

Point at: `Up`, the mapping `0.0.0.0:4001->4000/tcp`, and the two log lines `Database ready at host.docker.internal:5433/readspace` and `ReadSpace API listening on port 4000`.

**5. Access** (10 s). Open `http://localhost:4001`. The seat map appears. Say: "The browser talks to host port 4001, Docker forwards it to port 4000 in the container."

Hand over: "This is one container on my laptop. Aarya will show how Kubernetes runs it as several."

Afterwards: `docker rm -f readspace-demo`

Extra commands if the faculty asks to inspect more:

```
docker exec readspace-demo whoami                              # node (not root)
docker inspect -f "{{.Config.Cmd}} {{.Config.ExposedPorts}}" readspace-demo
docker history readspace:1.0                                   # the layers
```

**If something goes wrong**

| Problem | What to do |
|---------|------------|
| `container name "readspace-demo" is already in use` | Left from practice: `docker rm -f readspace-demo` |
| `port is already allocated` | Something else uses 4001: use `-p 4002:4000` and open that port |
| Logs repeat `Database not reachable` | The Compose database is not running: `docker compose up -d db` |
| The build starts downloading for a long time | The cache is gone. Stop it, show `docker images readspace` instead and explain |

## Your parts in the integration slot

**1. The walkthrough (25 seconds).** Say it while pointing at each browser tab:

> The code is in Git. A push starts GitHub Actions, which tests and builds it and builds the Docker image. Kubernetes runs that image as two pods. Each pod exposes /metrics. Prometheus scrapes them, and Grafana draws the dashboard from Prometheus.

Then give the dependency in one line: "If one stage fails, the next has nothing to work with: no passing tests, no image; no image, no pods; no pods, no metrics; no Prometheus, an empty dashboard."

Kartik and Trushna then show Prometheus.

**2. Grafana: dashboard, data source, query (about 25 seconds).** Grafana is shared with Aarya. The rubric's Grafana criteria are: open a dashboard, use PromQL and a visualization, explain it and identify an anomaly. **You show the dashboard and where its data comes from. Aarya generates the activity and interprets the anomaly.**

Before the demo: open `http://localhost:30030`, click "Sign in" and log in as `admin` with `GRAFANA_ADMIN_PASSWORD` from `.env`. Without this you can view the dashboard but cannot open a panel's query.

1. Open the dashboard **ReadSpace - PICT Reading Hall**. Say: "Grafana stores no data. Its data source is Prometheus, and every panel is a PromQL query."
2. On "HTTP Requests Over Time" open the panel menu > Edit. Point at the query `sum by (status) (rate(http_requests_total[1m]))` and the visualization type "Time series". Go back.
3. Point at "Occupied Seats" and say: "The same number as on the web page and in Prometheus."

Hand over: "Aarya will now create some activity and read the dashboard."

What to know (you and Aarya should both be able to answer all of this):

- **Data source**: the connection to Prometheus, `http://prometheus:9090`, created from `monitoring/grafana/provisioning/datasources/prometheus.yml`. `prometheus` is the Service name inside the cluster.
- **Dashboard as code**: `monitoring/grafana/dashboards/readspace.json`. Grafana loads it at startup, so it is identical on every machine. In Kubernetes these files are loaded as ConfigMaps by the deploy script.
- **Panels and queries**:

  | Panel | Type | Query |
  |-------|------|-------|
  | Occupancy | gauge | `max(reading_hall_occupancy_ratio)` |
  | Occupied Seats | stat | `max(reading_hall_seats_occupied)` |
  | Available Seats | stat | `max(reading_hall_seats_available)` |
  | Total Seats | stat | `max(reading_hall_seats_total)` |
  | HTTP Requests Over Time | time series | `sum by (status) (rate(http_requests_total[1m]))` |
  | Occupy vs Release Actions | time series | `sum(increase(reading_hall_occupy_actions_total[1m]))` and the same for release |
  | API Response Time | time series | average and 95th percentile from `http_request_duration_seconds` |

- **`max()` and `sum()`**: both pods read the same database and report the same seat count, so `max` takes it once. Each pod counts only its own requests, so those are added with `sum`.
- **Anomaly** (Aarya's part, but know it): a sudden change, read by checking which panels moved together. Occupancy and occupy actions jump together: a rush. Request rate up with 4xx lines and flat occupancy: rejected requests. All panels empty: Prometheus is down.

## Troubleshooting you lead

**C. Container runs but application is inaccessible**

1. `docker ps`: is the container `Up`? Read the PORTS column. Is there a mapping at all, and what is the container side?
2. `docker logs <name>`: which port does the application say it listens on?
3. Compare the two. `4001->3000` with an application on 4000 means the mapping points at a port nobody listens on.
4. If the ports agree: does the application bind to `0.0.0.0`? Is another program using the host port? Are you opening the right host port in the browser?
5. Fix: remove the container, run it again with the correct `-p`, verify in the browser.

Practice case:

```
docker run -d --name broken -p 4001:3000 --env-file .env -e DB_HOST=host.docker.internal readspace:1.0
docker ps --filter name=broken        # 0.0.0.0:4001->3000/tcp
docker logs broken                    # ReadSpace API listening on port 4000
```

The page at `http://localhost:4001` does not open. Fix: `docker rm -f broken`, then run with `-p 4001:4000`.

**F. Grafana panel shows no data** (with Aarya)

1. Is it one panel or all of them? All: the data source or Prometheus. One: the query.
2. Connections > Data sources > Prometheus > "Save & test".
3. Time range, top right. It must include now ("Last 15 minutes").
4. Copy the panel's query and run it at `http://localhost:30090/query`. No result there means the metric is missing or the target is down.
5. `kubectl get pods -l app=prometheus`: is Prometheus running?

Practice case: `kubectl scale deployment prometheus --replicas=0`, look at the dashboard, then `--replicas=1`.

Note: the request panels are empty until the API has received requests. That is not a fault.

## Other tools: the minimum you must know

- **Git**: add stages, commit saves locally, push sends to GitHub, pull brings changes back. Work happens on branches and reaches `main` through pull requests.
- **GitHub Actions**: `.github/workflows/ci.yml` runs on every push and pull request. Jobs: Test, Build, then Docker build and validation, which runs **your** `docker build` and starts the container to check it. If that job is red, read "Show container logs".
- **Kubernetes**: the Deployment runs two pods from `readspace:1.0` with `imagePullPolicy: IfNotPresent`, so it uses the image you built locally. `containerPort: 4000` is the same port as your `EXPOSE`. A Service gives the pods one address; the readiness probe calls `/health`.
- **Prometheus**: scrapes `/metrics` of every pod every five seconds. The targets page shows UP or DOWN. It is Grafana's only data source.

## Viva questions

**Image vs container?** The image is the package, the container is a running instance of it.

**What does `EXPOSE` do?** It documents the port. Publishing is done by `-p` at run time.

**`CMD` vs `ENTRYPOINT`?** `CMD` is the default command and can be replaced when starting the container. `ENTRYPOINT` is fixed and `CMD` becomes its arguments.

**`RUN` vs `CMD`?** `RUN` executes at build time and becomes part of the image. `CMD` executes when a container starts.

**`COPY` vs `ADD`?** `COPY` copies files. `ADD` can also download URLs and unpack archives. `COPY` is preferred because it does only what it says.

**Why a multi-stage build?** The build tools stay in the first stages; the final image is smaller and contains only what runs.

**Why is the database not in the same container?** One container, one job. With the data outside, the application container can be replaced or scaled without losing anything.

**Where is the database password?** Not in the image. It is passed as an environment variable at start, from `.env` or a Kubernetes Secret.

**How does Kubernetes get your image without a registry?** Docker Desktop's cluster can use images from the local image store. With a remote cluster we would push the image to a registry first.

**What happens to data when a container is removed?** Everything written inside it is lost. That is why the database uses a volume.

**Why does the dashboard use `max()` for seats?** Both pods report the same count from the shared database; `sum` would double it.

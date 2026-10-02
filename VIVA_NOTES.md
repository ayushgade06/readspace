# Viva notes

Short answers in plain language. Every group member should be able to give all of them, not only the ones for their own tool.

## Git

- **Why Git:** it keeps every version of the code, shows who changed what, and lets four people work on the same project without overwriting each other.
- **Commit:** a saved snapshot of the staged changes with a message. It exists only on the laptop until it is pushed.
- **Branch:** a separate line of commits. We build each feature on its own branch (`feature/docker`, `ci/github-actions`, ...) so `main` always works.
- **Merge / pull request:** a pull request asks to merge a branch into `main` on GitHub. The pipeline runs on it first; when it is green the branch is merged.
- **Commands we use:** `clone` (copy the repository), `switch -c` (new branch), `add` (stage), `commit`, `push` (send to GitHub), `pull` (fetch and merge from GitHub), `merge`.
- **Connects to:** GitHub Actions. A push or pull request is the event that starts the pipeline.

## GitHub Actions

- **CI/CD:** Continuous Integration means every push is automatically tested and built. Continuous Delivery means the result (here a Docker image that has been checked) is ready to deploy.
- **Trigger:** the `on:` section of `.github/workflows/ci.yml`: every push, and pull requests into `main`.
- **Jobs:**
  - *Test*: installs dependencies (`npm ci`) and runs the API tests against a PostgreSQL service container.
  - *Build*: compiles the TypeScript backend and builds the React frontend.
  - *Docker build and validation*: builds the image, checks the Prometheus configuration, starts the container and requests `/health`, `/api/stats`, `/metrics`.
- **`needs`:** the Docker job waits for Test and Build. If a test fails, no image is built.
- **Runner:** a fresh Ubuntu machine provided by GitHub for each job.
- **If it fails:** open the run, open the red job, read the first red step.
- **Connects to:** Git before it (the trigger), Docker after it (it builds the image).

## Docker

- **Image vs container:** an image is a read-only package with the application and everything it needs. A container is a running instance of an image. One image, many containers.
- **Dockerfile:** the recipe for building the image.
  - `FROM node:22-alpine`: the base image to start from.
  - `WORKDIR`: the directory inside the image where the following commands run.
  - `COPY`: copies files from the project into the image.
  - `RUN`: executes a command while building (`npm ci`, `npm run build`).
  - `EXPOSE 4000`: documents the port the application listens on.
  - `CMD ["node", "dist/server.js"]`: the command executed when a container starts. `ENTRYPOINT` is similar, but `CMD` can be replaced on the `docker run` command line, while `ENTRYPOINT` stays fixed and `CMD` becomes its arguments.
- **Multi-stage build:** stages 1 and 2 build the frontend and backend; stage 3 copies only the results. The final image has no compiler and no source code, so it is smaller.
- **Ports:** `-p 4000:4000` means host port : container port. The container port must be the one the application listens on. The application binds to `0.0.0.0`; if it bound to `127.0.0.1` it would be unreachable from outside the container.
- **Commands:** `docker build -t readspace:1.0 .`, `docker images`, `docker run`, `docker ps`, `docker logs`.
- **Connects to:** Kubernetes runs containers from this image.

## Kubernetes

- **Pod:** the smallest unit Kubernetes runs: one or more containers with one IP address. Our pod has one ReadSpace container.
- **Deployment:** describes the pod and how many copies should run. If a pod dies, the Deployment creates a new one.
- **Replicas:** the number of identical pods. We run 2.
- **Scaling:** `kubectl scale deployment readspace --replicas=2`. It works because the pods keep no data themselves; all of them use the same PostgreSQL database.
- **Service:** a fixed name and address in front of the pods, which come and go. It load-balances over the Ready pods.
  - `nodePort 30080`: opened on the node, so the browser can use `localhost:30080`
  - `port 80`: the Service's own port inside the cluster
  - `targetPort 4000`: the container port the traffic is sent to
- **Headless Service (`readspace-pods`):** no load balancing; its DNS name returns every pod IP. Prometheus uses it to scrape each pod.
- **Readiness probe:** `GET /health` every 5 seconds. It returns 200 only if the application can reach the database. A pod that is not Ready is taken out of the Service but not restarted.
- **Liveness probe:** checks that port 4000 accepts connections. If not, the container is restarted.
- **Secret / ConfigMap:** the database password is in a Secret; the Prometheus and Grafana configuration files are in ConfigMaps. Neither is baked into the image.
- **Troubleshooting order:** `kubectl get pods` (status) -> `kubectl logs <pod>` (what the application said; add `--previous` after a crash) -> `kubectl describe pod <pod>` (probes, exit code, events) -> `kubectl get events`.
- **CrashLoopBackOff:** the container starts, exits, and Kubernetes keeps restarting it with a growing delay. The reason is in the logs.
- **Connects to:** Docker before it (the image), Prometheus after it (pods are the scrape targets).

## Prometheus

- **What it does:** collects numbers (metrics) over time and stores them as time series that can be queried.
- **Metric:** a named number, optionally with labels, for example `http_requests_total{method="GET", route="/api/seats", status="200"}`.
- **Gauge / counter / histogram:** a gauge goes up and down (`reading_hall_seats_occupied`). A counter only goes up (`http_requests_total`), so we look at its rate. A histogram counts observations in buckets (`http_request_duration_seconds`), which gives averages and percentiles.
- **Scrape:** Prometheus pulls. Every 5 seconds it sends `GET /metrics` to each target and stores the answer.
- **Target:** one address that is scraped. Target health is UP when the scrape succeeded.
- **prometheus.yml:** `scrape_interval` says how often; `scrape_configs` lists the jobs. Our job `readspace` uses `static_configs` with `app:4000` in Compose, and `dns_sd_configs` with the headless Service in Kubernetes.
- **Exporter:** a separate program that exposes metrics for software that cannot do it itself (for example node_exporter for a machine). We do not need one: the application exposes `/metrics` itself using the `prom-client` library.
- **PromQL:** the query language.
  - `reading_hall_seats_occupied`: current value
  - `rate(http_requests_total[1m])`: requests per second, averaged over the last minute
  - `sum by (status) (rate(http_requests_total[1m]))`: the same, grouped by status code
  - `up{job="readspace"}`: 1 if the target is UP
- **Connects to:** the application before it (source of metrics), Grafana after it (reads the stored data).

## Grafana

- **What it does:** draws dashboards from data stored elsewhere. It stores no metrics itself.
- **Data source:** the connection to Prometheus (`http://prometheus:9090`), created from `monitoring/grafana/provisioning/datasources/prometheus.yml`.
- **Dashboard:** a page of panels, stored as JSON in `monitoring/grafana/dashboards/readspace.json`, so it can be recreated on any machine.
- **Panel:** one visualization with one or more PromQL queries. We have 7: Occupancy, Occupied Seats, Available Seats, Total Seats, HTTP Requests Over Time, Occupy vs Release Actions, API Response Time.
- **`max()` and `sum()`:** each pod reports the same seat counts (same database), so `max` picks the value once. Each pod counts only its own requests, so they are added with `sum`.
- **Reading an anomaly:** look for a sudden change and check which panels changed together.
  - Occupancy jumps and Occupy actions spike: many seats taken at once (rush).
  - Request rate rises but occupancy is flat, 4xx lines appear: requests are being rejected.
  - Response time rises with normal request rate: the API or database is slow.
  - All panels empty: Prometheus or the data source is down, not the application.
- **Connects to:** Prometheus. No Prometheus data means empty panels.

## Integration

Source code to dashboard:

1. Code is committed and pushed with **Git**.
2. The push triggers **GitHub Actions**: tests, build, Docker image, validation.
3. The **Docker** image contains the API and the built frontend.
4. **Kubernetes** runs the image as 2 pods behind a Service, with PostgreSQL next to it.
5. Each pod exposes `/metrics`; **Prometheus** scrapes every pod.
6. **Grafana** queries Prometheus and shows the dashboard.

What depends on what:

| If this breaks | Then |
|----------------|------|
| Tests fail in Actions | no image is built by the pipeline |
| Image is missing or wrong | pods show ImagePullBackOff or crash |
| Database is down | `/health` returns 503, pods become not Ready, the page shows an error |
| Pod port does not match the Service | pods are fine but the page does not open |
| `/metrics` not reachable | Prometheus target is DOWN |
| Prometheus is down | Grafana shows no data |

## Questions and short answers

**What happens between `git push` and a green tick?** GitHub receives the commit, sees a workflow whose `on:` matches, starts runners, and runs Test and Build in parallel, then the Docker job. All steps exiting with code 0 gives the green tick.

**Why does occupying the same seat twice not corrupt the data?** The update is `UPDATE seats SET status='occupied' WHERE id=? AND status='available'`. Only one request can match; the other gets 409.

**Why is the database not inside the application container?** A container should do one thing and be replaceable. With the data outside, pods can be scaled, restarted and replaced without losing anything.

**What would break if each pod kept seats in memory?** Two pods would show different seat maps, and the answer would depend on which pod handled the request.

**Which step fails first if the Dockerfile exposed the wrong port?** `EXPOSE` is documentation only, so nothing fails. If the application's `PORT` were wrong, the CI validation step would fail because `curl localhost:4000/health` would get no answer.

**Why two Prometheus configuration files?** Compose has one application container with a fixed name. Kubernetes has several pods with changing IPs, so the targets are discovered through DNS.

**Where is the database password?** In `.env` on the laptop (not in git), and in a Kubernetes Secret created from it by the deploy script.

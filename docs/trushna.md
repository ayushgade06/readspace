# Trushna — GitHub Actions (CI/CD Owner)

Also yours: Prometheus in the integration slot (shared with Kartik), and troubleshooting scenarios B (CI/CD build fails), plus A and E together with Kartik.

Read [README.md](README.md) first for the group part.

## Your 9 marks (rubric 4.2)

| Criterion | Marks | Expected evidence | What you do |
|-----------|-------|-------------------|-------------|
| Pipeline configuration | 3 | Explain workflow stages and configuration | Walk through `.github/workflows/ci.yml` |
| Trigger and build | 3 | Demonstrate trigger and automated build | Show the run that Kartik's push started, and its jobs |
| Deployment | 3 | Demonstrate or explain the deployment stage | Show the step that starts the built image as a container, and explain how it reaches Kubernetes |

## What you need to understand

**CI/CD**

- *Continuous Integration*: every push is automatically tested and built, so a broken change is found within a minute.
- *Continuous Delivery*: every change that passes is packaged and ready to deploy (for us: a Docker image that has been checked).
- *Continuous Deployment*: the passing change is also released automatically. We do not do this step.

**GitHub Actions vocabulary**

| Term | Meaning | In `ci.yml` |
|------|---------|-------------|
| Workflow | One YAML file in `.github/workflows/` | `ci.yml`, named `CI` |
| Event / trigger | What starts the workflow | `on: push` and `pull_request` into `main` |
| Job | A group of steps on one machine | `test`, `build`, `docker` |
| Step | One command or one action | `run: npm test` |
| Action | A reusable step written by someone else | `uses: actions/checkout@v4`, `actions/setup-node@v4` |
| Runner | The machine that executes a job | `runs-on: ubuntu-latest`, a fresh machine from GitHub for every job |
| Service container | A container started next to the job | `postgres:16-alpine` for the tests |

**The three jobs**

| Job | Steps | Why |
|-----|-------|-----|
| **Test** | Checkout, set up Node 22, `npm ci`, `npm test` | The API tests run against a real PostgreSQL database, started as a service container. The `env:` block gives the tests the database address. |
| **Build** | Checkout, set up Node, `npm ci` and `npm run build` for backend and frontend | Proves the TypeScript compiles and the frontend bundles |
| **Docker build and validation** | `docker build -t readspace:1.0 .`, `docker images`, `promtool check config`, `docker compose up -d db app`, `curl` against `/health`, `/api/stats`, a seat request, `/metrics` and the web page, then logs and clean-up | Builds the image and proves a container started from it really works |

Details the faculty may ask about:

- `needs: [test, build]`: the Docker job starts only if both earlier jobs pass. Test and Build run in parallel.
- `npm ci` instead of `npm install`: installs exactly what `package-lock.json` says, so every run uses the same versions.
- `if: always()` on "Show container logs" and "Stop containers": they run even when an earlier step failed, so the logs are there for diagnosis.
- `cp .env.example .env`: the runner has no `.env` (it is not in Git), so the example file is used. The database lives only for that run.
- `POSTGRES_PASSWORD: ci-only-password`: a throwaway value for a database that exists for one minute. Real secrets would go in repository Settings > Secrets and be read as `${{ secrets.NAME }}`.
- A step fails when its command exits with a non-zero code. `curl -f` makes curl do that on an HTTP error.

**The deployment criterion: what to say**

> The third job is our delivery stage. It builds the image and deploys it as a container on the runner together with a database, then checks it with real requests. So every green run means the image is deployable. The final deployment to Kubernetes is done from the laptop with `scripts\k8s-deploy.ps1`, because our cluster is local and GitHub's runners cannot reach a laptop. With a cloud cluster we would add two steps: push the image to a registry, and run `kubectl apply` with the cluster credentials stored as a secret.

That is an honest answer and it matches the rubric wording "demonstrates or explains deployment stage".

**GitHub Actions and Jenkins** (the rubric names both)

Both run pipelines. Jenkins is a server you install and maintain yourself, with the pipeline in a `Jenkinsfile`. GitHub Actions is hosted by GitHub, the pipeline is a YAML file in the repository, and it is triggered directly by repository events. We chose Actions because the code is already on GitHub and nothing has to be installed.

## Your demo (70-90 seconds)

Have ready: the Actions tab, and `.github/workflows/ci.yml` open in the editor or on GitHub.

**1. Trigger** (15 s). Open the Actions tab.

Point at: the run at the top with Kartik's commit message `docs: add demo note` and branch `demo/readme-note`. Say: "His push is the event. Nobody started this by hand."

**2. Configuration** (30 s). Show `ci.yml`. Point at four things only:

- `on:` with `push` and `pull_request`
- `jobs:` `test`, `build`, `docker`
- `services: postgres` under `test`
- `needs: [test, build]` under `docker`

**3. Build result** (25 s). Open the latest finished run on `main` (its name starts with `Merge pull request`).

Point at: the graph with Test and Build side by side and the Docker job after them, all green. Open the Docker job and expand "Build Docker image", then "List image" (`readspace 1.0`).

**4. Deployment stage** (20 s). Expand "Validate the running container".

Point at the `/health` output `{"status":"ok","database":"up"}` and the `/api/stats` output. Give the deployment explanation above in two sentences.

Hand over: "The last job built the Docker image. Ayush will show that image."

**If something goes wrong**

| Problem | What to do |
|---------|------------|
| Kartik's run is still yellow | Good: say "it is running now", and show the previous finished run for the details |
| No internet | Show `ci.yml` locally and explain. Take screenshots of a green run before the day as a backup |
| A run is red | Do not hide it. Open it and read the failing step: that is the troubleshooting criterion |

## Your part in the integration slot: Prometheus configuration and queries (about 25 seconds)

Prometheus is shared with Kartik. The rubric's Prometheus criteria are: architecture (targets, exporters), scrape configuration, target status and a query. Kartik shows `/metrics`, the targets page and explains the architecture. **You take over from him with the configuration file and the queries.**

1. Open `monitoring/prometheus/prometheus.k8s.yml`. Point at three lines:
   - `scrape_interval: 5s` — how often Prometheus collects
   - `job_name: readspace` and `metrics_path: /metrics` — what it collects
   - `dns_sd_configs` with `readspace-pods.default.svc.cluster.local` and `port: 4000` — where it finds the targets

   Say: "We do not write pod addresses by hand. This name belongs to a headless Service and returns the IP of every pod, so a new pod becomes a new target on its own."
2. Open `http://localhost:30090/query` and run:
   ```
   reading_hall_seats_occupied
   ```
   Point at: one result per pod, the same value as on the web page.
3. Run:
   ```
   rate(http_requests_total[1m])
   ```
   Say: "A counter only goes up, so we ask for its rate: requests per second over the last minute."

Hand over: "Prometheus has the data. Ayush and Aarya will show it in Grafana."

What to know (you and Kartik should both be able to answer all of this):

- **What Prometheus is**: a monitoring system that collects numbers over time and stores them as time series.
- **Pull model**: Prometheus fetches `/metrics` from each target; the application does not send anything.
- **Target**: one address that is scraped. UP means the last scrape worked.
- **Two configuration files**: `prometheus.yml` for Docker Compose has one fixed target, `app:4000`. `prometheus.k8s.yml` for Kubernetes discovers the pods through DNS, because pod IPs change.
- **How the file reaches Prometheus in Kubernetes**: the deploy script loads it into a ConfigMap, which is mounted into the Prometheus pod at `/etc/prometheus/prometheus.yml`.
- **Exporter**: a separate program that publishes metrics for software that cannot do it itself, for example node_exporter for a machine. We do not use one: the application publishes `/metrics` itself with the `prom-client` library.
- **Metric types**: gauge goes up and down (`reading_hall_seats_occupied`); counter only goes up (`http_requests_total`); histogram counts observations in buckets (`http_request_duration_seconds`).
- **Queries that work**: `reading_hall_seats_occupied`, `reading_hall_seats_available`, `reading_hall_occupancy_ratio`, `rate(http_requests_total[1m])`, `sum by (status) (rate(http_requests_total[1m]))`, `up{job="readspace"}`.
- **The pipeline checks this file**: the step "Validate Prometheus configuration" in your Docker job runs `promtool check config` on both files. That is a link between your tool and Prometheus worth mentioning.

## Troubleshooting you lead

**B. CI/CD build fails**

1. Actions tab > open the red run. Which job is red: Test, Build or Docker?
2. Open the job, open the red step, read the **first** error.
3. By job:
   - *Test*: the log shows the test name and `expected ... to be ...`. Either the code or the test is wrong.
   - *Build*: a TypeScript error with file and line.
   - *Install step*: `npm ci` fails when `package-lock.json` does not match `package.json`.
   - *Docker*: read the build output; if the container started but `curl` failed, read "Show container logs".
4. Reproduce locally: `npm test`, `npm run build`, `docker build -t readspace:1.0 .`
5. Fix, commit, push. The pipeline runs again by itself. Verify the green tick.

Practice case: on a branch change the first `toBe(200)` in `backend/tests/api.test.ts` to `toBe(201)` and push. The Test job fails with `AssertionError: expected 200 to be 201`, and the Docker job is **skipped** because of `needs`. Fix with `git revert HEAD` and push.

**A. Push does not trigger CI/CD** (with Kartik)

Kartik checks the repository and the branch. You check the workflow side:

1. Is `.github/workflows/ci.yml` present on the pushed branch? Folder name and `.yml` extension must be exact.
2. Actions tab: a workflow with a YAML mistake is listed with an error instead of running.
3. The `on:` section: ours has `push:` for all branches. With `branches: [main]` a push to another branch would not start it.
4. Repository Settings > Actions: Actions must be enabled.

**E. Prometheus target is DOWN** (with Kartik)

1. Targets page: read the error next to the target (`connection refused`, `context deadline exceeded`, `server returned HTTP status 404`).
2. Open the application's `/metrics` in the browser: does it answer?
3. `kubectl get pods -o wide`: is the pod with that IP running, or crashing?
4. Compare with `prometheus.k8s.yml`: Service name, port 4000, path `/metrics`. A wrong port or path here makes every target DOWN.
5. `kubectl logs deployment/prometheus --tail=20` for configuration errors.

In our practice case the target is DOWN because the pod is in CrashLoopBackOff, so nothing listens on its port. Fixing the pod fixes the target.

## Other tools: the minimum you must know

- **Git**: add stages, commit saves locally, push sends to GitHub, pull brings changes back. Work happens on branches and reaches `main` through pull requests. The push is your trigger.
- **Docker**: the Dockerfile has three stages: build frontend, build backend, final image with only what runs. `FROM` base image, `COPY` files in, `RUN` a command at build time, `CMD` the command at container start. The app listens on 4000.
- **Kubernetes**: a Deployment keeps two pods of `readspace:1.0` running, a Service gives them one address, the readiness probe calls `/health`. Diagnose with `kubectl get`, `logs`, `describe`, `get events`.
- **Grafana**: reads from Prometheus and draws seven panels; it stores no metrics itself. If Prometheus is down, every panel is empty. The seat panels use `max()` because both pods report the same count from the shared database; the request panels use `sum()` because each pod counts only its own requests.

## Viva questions

**What triggers your workflow?** Any push, and any pull request into `main`: the `on:` section.

**What happens if a test fails?** The Test job is red, the Docker job is skipped because of `needs`, and the pull request shows a failed check.

**Why does the test job need PostgreSQL?** The API tests occupy and release real seats, so they need a real database. GitHub starts it as a service container.

**Where does the pipeline run?** On a fresh Ubuntu virtual machine provided by GitHub, one per job. Nothing is kept between runs.

**Difference between a job and a step?** A job is a set of steps on one runner. Jobs can run in parallel; steps run in order.

**Difference between `uses` and `run`?** `uses` calls a ready-made action. `run` executes a shell command.

**Is your pipeline CI or CD?** CI plus delivery: it tests, builds, and produces a verified image. The release to the cluster is a manual command.

**How would you add automatic deployment?** Push the image to a registry, store the cluster credentials as a secret, add a job that runs `kubectl apply` or `kubectl set image`.

**Why validate the container if the tests already passed?** The tests run the source code. The validation runs the image, which catches a broken Dockerfile, a wrong port or a missing file.

**What does `scrape_interval` mean?** How often Prometheus requests `/metrics` from each target. Ours is five seconds.

**Why is `rate()` used on `http_requests_total`?** It is a counter, so its raw value only grows. `rate` turns it into requests per second.

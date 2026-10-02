# Demo script (8-10 minutes)

ReadSpace — PICT Reading Hall. Group Classroom CIE-01.

Roles:

| Student | Primary tool | Also presents |
|---------|--------------|---------------|
| Kartik | Git | Prometheus (with Trushna) |
| Trushna | GitHub Actions | Prometheus (with Kartik) |
| Ayush | Docker | Integration walkthrough, Grafana (with Aarya) |
| Aarya | Kubernetes | Troubleshooting lead, Grafana (with Ayush) |

Everyone must be able to explain the whole pipeline, not only their own tool. See [VIVA_NOTES.md](VIVA_NOTES.md) and the personal study notes in [docs/](docs/README.md).

## Before the demo (do this 15 minutes earlier)

1. Start Docker Desktop and wait until Kubernetes shows as running.
2. In the repository root:
   ```
   git switch main
   git pull
   docker compose up -d db
   docker build -t readspace:1.0 .
   powershell -ExecutionPolicy Bypass -File scripts\k8s-deploy.ps1
   ```
   If http://localhost:30080 does not open, the cluster does not publish NodePorts (Docker Desktop with the kind provisioner). Leave this running in a separate terminal for the whole demo:
   ```
   powershell -ExecutionPolicy Bypass -File scripts\k8s-port-forward.ps1
   ```
   Then reset the seats:
   ```
   node scripts/simulate.mjs clear
   ```
3. Open these tabs in the browser, in this order:
   1. GitHub repository: https://github.com/ayushgade06/readspace
   2. GitHub Actions: https://github.com/ayushgade06/readspace/actions
   3. ReadSpace: http://localhost:30080
   4. Prometheus targets: http://localhost:30090/targets
   5. Prometheus query: http://localhost:30090/query
   6. Grafana: http://localhost:30030
4. Open two terminals in the repository root. Use a large font.
5. Click a few seats on the ReadSpace page so the dashboard has some history.

## 0:00-1:00 Introduction

Each student: name, tool, role (one sentence each).

Kartik then shows the ReadSpace tab and says:

> ReadSpace shows the seats of the PICT reading hall. Green outlined seats are free, filled seats are in use. Clicking a seat occupies or releases it. The application is small on purpose: the project is about the pipeline from Git to Grafana.

Click one free seat. Point at: the seat changes, the counts change, a line is added to Recent Activity.

## 1:00-5:00 Tool demonstrations

### Kartik — Git (about 70 seconds)

```
git log --oneline --graph -12
git branch -a
```

Point at: one commit per milestone, feature branches merged into `main`.

Make a small change live. Create the branch, add one line at the end of `README.md` in the editor (for example `Demo run: CIE-01`), save, then:

```
git switch -c demo/readme-note
git status
git add README.md
git commit -m "docs: add demo note"
git push -u origin demo/readme-note
```

Say: `switch -c` creates a branch, `add` stages the change, `commit` records it locally, `push` sends it to GitHub. Changes reach `main` through a pull request, and `git pull` brings merged work back to each laptop.

Expected result: the branch appears on GitHub, and the push starts a pipeline run (Trushna picks this up).

### Trushna — GitHub Actions (about 70 seconds)

Open the Actions tab. Point at: the run that Kartik's push just started.

Open the latest finished run. Point at the three jobs: **Test**, **Build**, **Docker build and validation**.

Open `.github/workflows/ci.yml` and point at:

- `on: push` and `pull_request`: what triggers the workflow
- the `postgres` service: the tests use a real database
- `needs: [test, build]`: the Docker job runs only if the first two pass

Open the "Validate the running container" step. Point at the `/health` and `/api/stats` output: the pipeline started a container from the image and checked that it answers.

Expected result: green ticks on all three jobs.

### Ayush — Docker (about 80 seconds)

Open `Dockerfile`. Point at `FROM`, `COPY`, `RUN`, `EXPOSE 4000`, `CMD`. Say: three stages; the last one contains only what is needed to run.

```
docker images readspace
docker run -d --name readspace-demo -p 4001:4000 --env-file .env -e DB_HOST=host.docker.internal readspace:1.0
docker ps --filter name=readspace-demo
docker logs readspace-demo
```

Point at: the tag `1.0`, the mapping `0.0.0.0:4001->4000/tcp`, the log line `ReadSpace API listening on port 4000`.

Open http://localhost:4001. Say: host port 4001 is mapped to container port 4000, the port the application listens on.

```
docker rm -f readspace-demo
```

### Aarya — Kubernetes (about 80 seconds)

```
kubectl get deployments
kubectl get pods
kubectl get services
```

Point at: `readspace 2/2`, both pods `Running` and `1/1` Ready, Service `readspace` with `80:30080/TCP`.

Scale down and up:

```
kubectl scale deployment readspace --replicas=1
kubectl get pods -l app=readspace
kubectl scale deployment readspace --replicas=2
kubectl get pods -l app=readspace
```

Reload http://localhost:30080 while scaling: the page keeps working because the Service only sends traffic to Ready pods.

```
kubectl describe pod -l app=readspace
kubectl logs deployment/readspace --tail=5
```

Point at in the describe output: `Readiness: http-get http://:4000/health`, `Liveness: tcp-socket :4000`, and the Events at the bottom.

## 5:00-7:00 End-to-end integration (Ayush leads; Kartik and Trushna show Prometheus; Ayush and Aarya show Grafana)

Ayush, one sentence per step while pointing at the matching tab:

> The code is in Git. A push starts GitHub Actions, which tests and builds it and produces the Docker image. Kubernetes runs that image as two pods. Each pod exposes /metrics. Prometheus scrapes it, and Grafana draws the dashboard from Prometheus.

Kartik — Prometheus architecture and targets:

1. Open http://localhost:30080/metrics. Point at `reading_hall_seats_occupied`.
2. Open the targets tab. Point at: job `readspace`, one target per pod, state **UP**.

Trushna — Prometheus configuration and queries:

1. Open `monitoring/prometheus/prometheus.k8s.yml`. Point at `scrape_interval`, `metrics_path` and the `dns_sd_configs` name.
2. On the query tab run `reading_hall_seats_occupied`, then `rate(http_requests_total[1m])`.

Ayush — Grafana dashboard (signed in as admin):

1. Open the dashboard. Say: Grafana stores no data; its data source is Prometheus.
2. On "HTTP Requests Over Time" open the panel menu > Edit and point at the query. Go back.

Aarya — Grafana anomaly, with the dashboard visible:

```
node scripts/simulate.mjs rush
```

Point at: Occupancy climbing to 100 %, Available Seats falling to 0, a spike in HTTP Requests and in Occupy actions.

Say: this is an anomaly. Occupancy went from normal to full in a few seconds and the request rate jumped at the same moment, so it was caused by a burst of occupy requests. In a real hall this pattern would be the rush before an exam.

```
node scripts/simulate.mjs errors
```

Point at: the `HTTP 404` and `HTTP 409` lines appearing in HTTP Requests Over Time. Say: errors rose while occupancy did not change, so requests are being rejected.

```
node scripts/simulate.mjs clear
```

## 7:00-9:00 Troubleshooting (Aarya leads)

The faculty chooses the failure. The method is the same every time: look at the status, read the logs, read the events, compare with the configuration, fix, verify.

Each scenario below has a command to cause it (for practice), what to run, what you will see, and the fix.

**A. Push does not start the pipeline**

- Check: is `.github/workflows/ci.yml` on that branch, is the `on:` section correct, is the push in the right repository (`git remote -v`), does the Actions tab show a workflow syntax error.

**B. Pipeline fails**

- Cause it: on a branch, change `toBe(200)` to `toBe(201)` in `backend/tests/api.test.ts`, commit and push.
- See: the Test job is red. Open it, open "Run API tests", read the failing test and the expected/received values.
- Fix: revert the change, push again.

**C. Container runs but the page does not open**

- Cause it: `docker run -d --name broken -p 4001:3000 --env-file .env -e DB_HOST=host.docker.internal readspace:1.0`
- See: `docker ps` shows `4001->3000`, `docker logs broken` says `listening on port 4000`. The mapping points at the wrong container port.
- Fix: `docker rm -f broken`, run again with `-p 4001:4000`.

**D. Pod is in CrashLoopBackOff**

- Cause it: `kubectl set env deployment/readspace DB_HOST-` (removes the variable)
- Run:
  ```
  kubectl get pods
  kubectl logs -l app=readspace --tail=5
  kubectl describe pod -l app=readspace
  kubectl get events --sort-by=.lastTimestamp
  ```
- See: new pod `CrashLoopBackOff`, log line `Configuration error: environment variable DB_HOST is not set.`, event `Back-off restarting failed container`. The old pods keep serving the page.
- Fix: `kubectl apply -f k8s/deployment.yaml` (puts the variable back)

**Pod is Running but not Ready**

- Cause it: `kubectl scale deployment postgres --replicas=0`
- See: after about 15 seconds `kubectl get pods` shows `0/1` for the readspace pods. `kubectl describe pod -l app=readspace` shows `Readiness probe failed: HTTP probe failed with statuscode: 503`. The page shows "Backend unavailable".
- Fix: `kubectl scale deployment postgres --replicas=1`

**Pods are Ready but the page does not open**

- Cause it: change `targetPort: 4000` to `targetPort: 3000` in `k8s/service.yaml` (first Service), then `kubectl apply -f k8s/service.yaml`
- See: `kubectl get pods` is fine. `kubectl get endpoints readspace` lists port 3000, but the container listens on 4000 (`kubectl describe pod`, `kubectl logs`).
- Fix: restore `targetPort: 4000` and apply again.

**E. Prometheus target is DOWN**

- Cause it: scenario D. The crashing pod is listed as a target but nothing answers on its port.
- See: http://localhost:30090/targets shows the target **DOWN** with `connection refused`. Opening `/metrics` and checking `kubectl get pods` shows why.
- Fix: as in D.

**F. Grafana shows no data**

- Cause it: `kubectl scale deployment prometheus --replicas=0`
- See: panels show an error or "No data". Connections > Data sources > Prometheus > Save & test fails. Check the time range, then run the panel query on the Prometheus page.
- Fix: `kubectl scale deployment prometheus --replicas=1`

## 9:00-10:00 Viva

Questions to be ready for (answers in [VIVA_NOTES.md](VIVA_NOTES.md)):

1. What is the difference between an image and a container?
2. What happens between `git push` and a green tick in Actions?
3. Why does the Service use port 80, targetPort 4000 and nodePort 30080?
4. What is the difference between the readiness and the liveness probe here?
5. What is a scrape target, and how does Prometheus find the pods?
6. Why does the dashboard use `max()` for seats and `sum()` for requests?
7. Both pods share one database. What would break if each pod kept seats in memory?
8. Which step would fail first if the Dockerfile had the wrong port?

## After the demo

```
git switch main
git branch -D demo/readme-note
git push origin --delete demo/readme-note
node scripts/simulate.mjs clear
```

# Aarya — Kubernetes (Orchestration Owner)

Also yours: leading the troubleshooting slot, Grafana in the integration slot (shared with Ayush), and troubleshooting scenarios D (Pod is CrashLoopBackOff) and F (Grafana shows no data) together with Ayush.

Read [README.md](README.md) first for the group part.

## Your 9 marks (rubric 4.4)

| Criterion | Marks | Expected evidence | What you do |
|-----------|-------|-------------------|-------------|
| Deployment | 3 | Apply or explain the Deployment YAML and verify Pods | Walk through `k8s/deployment.yaml`, `kubectl apply`, `kubectl get pods` |
| Service / scaling | 3 | Demonstrate Service exposure or replica scaling | `kubectl get services`, scale 2 -> 1 -> 2 while the page keeps working |
| Troubleshooting | 3 | Use kubectl get / describe / logs / events to diagnose a problem | Run all four on a pod and say what each one tells you |

The third criterion is part of your **own** 9 marks, separate from the group troubleshooting slot. Show the four commands during your demo even when nothing is broken.

## What you need to understand

**Objects**

| Object | What it is | Ours |
|--------|-----------|------|
| Cluster / node | The machines Kubernetes manages. A node runs pods. | One node, `desktop-control-plane`, inside Docker Desktop |
| Pod | The smallest unit: one or more containers sharing one IP | One `readspace` container per pod |
| Deployment | Describes the pod and how many copies must run; replaces pods that die | `readspace`, 2 replicas |
| ReplicaSet | Created by the Deployment to keep the pod count | `readspace-6546fb55b6` |
| Service | A fixed name and address in front of pods, load-balancing over the Ready ones | `readspace`, `readspace-pods`, `postgres`, `prometheus`, `grafana` |
| Secret | Holds sensitive values | `readspace-db` with the database password |
| ConfigMap | Holds configuration files | Prometheus and Grafana configuration |
| PersistentVolumeClaim | Storage that survives pod restarts | `postgres-data` |

**`k8s/deployment.yaml`, the parts to explain**

```yaml
kind: Deployment
metadata:
  name: readspace
spec:
  replicas: 2                      # how many pods
  selector:
    matchLabels:
      app: readspace               # which pods belong to this Deployment
  template:                        # the pod to create
    metadata:
      labels:
        app: readspace             # must match the selector above
    spec:
      containers:
        - name: readspace
          image: readspace:1.0     # the image Ayush built
          imagePullPolicy: IfNotPresent   # use the local image, do not pull
          ports:
            - containerPort: 4000  # the port the application listens on
          env:                     # configuration, not baked into the image
            - name: DB_HOST
              value: postgres      # the name of the database Service
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef: { name: readspace-db, key: DB_PASSWORD }
          readinessProbe:
            httpGet: { path: /health, port: 4000 }
          livenessProbe:
            tcpSocket: { port: 4000 }
```

- **Labels and selectors** tie everything together. The Deployment and the Service both find the pods through `app: readspace`.
- **Declarative**: the YAML states the wanted result. `kubectl apply` makes the cluster match it, and Kubernetes keeps it that way. Delete a pod and a new one appears.

**`k8s/service.yaml`: the port chain**

```
browser -> localhost:30080 (nodePort) -> Service port 80 -> targetPort 4000 -> containerPort 4000
```

- `type: NodePort` opens a port on the node so the Service is reachable from outside the cluster. `ClusterIP` (the default) is reachable only inside. `LoadBalancer` asks a cloud provider for an external address.
- `targetPort` must equal the `containerPort`. If it does not, the pods are healthy but the Service sends traffic to a closed port.
- `readspace-pods` is a **headless** Service (`clusterIP: None`): no load balancing, its DNS name returns every pod IP. Prometheus uses it to scrape each pod separately.

**On the demo laptop**: Docker Desktop's cluster here does not publish NodePorts on `localhost`, so `scripts\k8s-port-forward.ps1` forwards local port 30080 to the Service. If asked, say so plainly and show the NodePort with `kubectl get services`.

**Probes**

| Probe | Check | When it fails |
|-------|-------|---------------|
| Readiness | `GET /health` every 5 s. Returns 200 only when the application can reach the database. | The pod is taken out of the Service (no traffic), but **not** restarted |
| Liveness | Is port 4000 accepting connections, every 10 s | The container is restarted |

**Scaling and why it works**

`kubectl scale deployment readspace --replicas=N` changes the pod count. It works because the pods keep no data themselves: all of them use the same PostgreSQL database, so every pod shows the same seats. If seats were kept in memory, two pods would disagree.

**Pod states you may see**

| Status | Meaning |
|--------|---------|
| `Running`, `1/1` | Running and Ready |
| `Running`, `0/1` | Running but the readiness probe fails |
| `ContainerCreating` | Starting |
| `CrashLoopBackOff` | The container starts, exits, and is restarted with a growing delay |
| `ImagePullBackOff` | The image cannot be found |
| `Terminating` | Being removed |

**The four troubleshooting commands**

| Command | What it tells you |
|---------|-------------------|
| `kubectl get pods` | Status, Ready count, restart count: where the problem is |
| `kubectl logs <pod>` | What the application printed: why it fails. Add `--previous` for the container that crashed before the current one. |
| `kubectl describe pod <pod>` | Image, probes, state, exit code, and the events of that pod |
| `kubectl get events --sort-by=.lastTimestamp` | What the cluster did, in time order: probe failures, restarts, scheduling |

## Your demo (70-90 seconds)

Have ready: `k8s/deployment.yaml` open in the editor, a terminal in the repository root, the ReadSpace tab (`http://localhost:30080`).

**1. Deployment** (25 s). Point in `deployment.yaml` at `replicas: 2`, `image: readspace:1.0`, `containerPort: 4000`, `readinessProbe`. Then:

```
kubectl apply -f k8s/deployment.yaml
kubectl get deployments
kubectl get pods
```

Point at: `deployment.apps/readspace unchanged` (the cluster already matches the file), `readspace 2/2`, two pods `Running` and `1/1`.

**2. Service** (15 s)

```
kubectl get services
kubectl get endpoints readspace
```

Point at: `readspace  NodePort  80:30080/TCP`, and the endpoints listing two pod IPs with port 4000. Say the port chain. (`kubectl get endpoints` prints a deprecation warning on this version; ignore it.)

**3. Scaling** (20 s)

```
kubectl scale deployment readspace --replicas=1
kubectl get pods -l app=readspace
kubectl scale deployment readspace --replicas=2
kubectl get pods -l app=readspace
```

Reload the page in between. Say: "The page keeps working, because the Service only sends traffic to Ready pods and all pods share one database."

**4. Troubleshooting commands** (25 s)

```
kubectl describe pod -l app=readspace
kubectl logs deployment/readspace --tail=5
kubectl get events --sort-by=.lastTimestamp
```

Point in the describe output at `Image: readspace:1.0`, `Readiness: http-get http://:4000/health`, `Liveness: tcp-socket :4000`, and the Events at the bottom. Say: "get shows where the problem is, logs show why, describe and events show what Kubernetes did about it."

Hand over: "Both pods expose metrics. We will now show the whole chain."

Optional, if there is time or the faculty asks about self-healing:

```
kubectl delete pod <one-readspace-pod>
kubectl get pods -l app=readspace
```

A new pod with a different name is already there. The Deployment replaced it.

**If something goes wrong**

| Problem | What to do |
|---------|------------|
| `kubectl` cannot connect | Kubernetes is not running in Docker Desktop. Wait for it or restart Docker Desktop. |
| The page does not open but pods are fine | The port-forward terminal was closed. Start `scripts\k8s-port-forward.ps1` again. |
| A pod shows restarts after the laptop woke up | Normal: the database took a moment to come back. Show that it is `1/1` now. |
| After scaling, the page pauses for a second | The port-forward is reconnecting to another pod. Reload. |

## Your part in the integration slot: Grafana anomaly (about 40 seconds)

Grafana is shared with Ayush. He opens the dashboard and shows the data source and a panel's query. **You generate the activity and interpret what the dashboard shows.** This is the rubric's third Grafana criterion: "explains visualization and identifies an anomaly".

1. With the dashboard visible, run:
   ```
   node scripts/simulate.mjs rush
   ```
   Say: "This script sends real occupy requests to the API, one seat after another. Nothing on the dashboard is faked."
2. Point at: the Occupancy gauge climbing to 100 % and turning red, Available Seats falling to 0, the spike in HTTP Requests and in Occupy actions.
3. Interpret it:
   > This is an anomaly. Occupancy went from normal to full within seconds, and the request rate and the occupy count jumped at the same moment. So the cause is a burst of occupy requests, not a fault in the system. In a real hall this is the rush before an exam.
4. If there is time:
   ```
   node scripts/simulate.mjs errors
   ```
   Point at the HTTP 404 and HTTP 409 lines. "Now errors rise while occupancy stays the same: requests are being rejected."
5. Afterwards: `node scripts/simulate.mjs clear`

How to read the dashboard:

| What you see | What it means |
|--------------|---------------|
| Occupancy jumps, occupy actions spike | Many seats taken at once |
| Request rate up, occupancy flat, 4xx lines appear | Requests are being rejected |
| Response time up, request rate normal | The API or the database is slow |
| Every panel empty | Prometheus or the data source is down, not the application |

What to know (you and Ayush should both be able to answer all of this):

- **Grafana stores nothing.** Its data source is Prometheus at `http://prometheus:9090`; every panel is a PromQL query.
- **Seven panels**: Occupancy (gauge), Occupied Seats, Available Seats, Total Seats (stat), HTTP Requests Over Time, Occupy vs Release Actions, API Response Time (time series).
- **`max()` and `sum()`**: both pods report the same seat count from the shared database, so `max` takes it once. Each pod counts only its own requests, so those are added with `sum`. This is a Kubernetes point as much as a Grafana one: it exists because we run two replicas.
- **The dashboard is a file**: `monitoring/grafana/dashboards/readspace.json`, loaded into the cluster as a ConfigMap. Nothing was clicked together by hand.
- **Gauge colours**: green below 70 %, orange from 70 %, red from 90 %.

## Troubleshooting you lead

You run the troubleshooting slot. Say the method first, then follow it:

> Status first, then logs, then events, then compare with the configuration, then fix and verify.

**D. Pod is CrashLoopBackOff**

```
kubectl get pods
kubectl logs <pod> --previous
kubectl describe pod <pod>
kubectl get events --sort-by=.lastTimestamp
```

1. `get pods`: which pod, and how many restarts.
2. `logs --previous`: the last lines before the container exited. This is usually the answer.
3. `describe`: `Last State: Terminated`, `Exit Code`, and the event `Back-off restarting failed container`.
4. Decide the category: configuration (missing or wrong variable, missing Secret), application (a bug at startup), dependency (database not reachable), resources (`OOMKilled` in the describe output means the memory limit was exceeded).
5. Fix the cause, apply, verify `1/1 Running`.

Practice case:

```
kubectl set env deployment/readspace DB_HOST-
```

The new pod goes to `CrashLoopBackOff`, its log says `Configuration error: environment variable DB_HOST is not set.`, and describe shows `Exit Code: 1`. The two old pods keep serving the page, because the rollout waits for the new pod to become Ready. Fix:

```
kubectl apply -f k8s/deployment.yaml
kubectl get pods -l app=readspace
```

Other Kubernetes faults the faculty may introduce:

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| Pods `Running` but `0/1` | `kubectl describe pod`: `Readiness probe failed: HTTP probe failed with statuscode: 503`. `/health` fails because the database is unreachable: `kubectl get pods -l app=postgres`. | Bring the database back: `kubectl scale deployment postgres --replicas=1` |
| Pods `1/1` but the page does not open | `kubectl get endpoints readspace` shows a port other than 4000, or no addresses. Wrong `targetPort`, or the Service selector does not match the pod labels. | Correct `k8s/service.yaml`, `kubectl apply -f k8s/service.yaml` |
| `ImagePullBackOff` | `kubectl describe pod`: the image name or tag does not exist locally | `docker build -t readspace:1.0 .` or correct the image name |
| Pod `Pending` | `kubectl describe pod`: events say why it cannot be scheduled (resources, missing volume) | Depends on the event |

Practice commands for the first two are in [../DEMO.md](../DEMO.md).

**F. Grafana panel shows no data** (with Ayush)

1. Is it one panel or all of them? All: the data source or Prometheus. One: the query.
2. Connections > Data sources > Prometheus > "Save & test".
3. Time range, top right. It must include now.
4. Run the panel's query at `http://localhost:30090/query`.
5. `kubectl get pods -l app=prometheus`: is Prometheus running? This is your command; Ayush checks the Grafana side.

**When the scenario belongs to someone else** (A, B, C, E): hand it over by name, "This is a pipeline problem, Trushna will take it", and run commands for them if they ask.

## Other tools: the minimum you must know

- **Git**: add stages, commit saves locally, push sends to GitHub, pull brings changes back. Work happens on branches and reaches `main` through pull requests. The manifests in `k8s/` are versioned like the code.
- **GitHub Actions**: `.github/workflows/ci.yml` runs on every push and pull request. Jobs: Test, Build, then Docker build and validation. It does not deploy to our cluster, because GitHub cannot reach a laptop; we deploy with `scripts\k8s-deploy.ps1`.
- **Docker**: the Dockerfile builds `readspace:1.0` in three stages. `FROM` base image, `COPY` files in, `RUN` at build time, `CMD` at container start. The application listens on 4000, which is your `containerPort`. A pod is a wrapper around this container.
- **Prometheus**: finds your pods through the headless Service `readspace-pods` and scrapes `/metrics` on each. A crashing pod shows as a DOWN target. Scale to three replicas and a third target appears.

## Viva questions

**Pod vs container?** A container is one running image. A pod is Kubernetes' wrapper around one or more containers that share an IP address.

**Deployment vs pod?** A pod on its own is not replaced when it dies. A Deployment keeps the requested number running and handles updates.

**Why do we need a Service?** Pod IPs change every time a pod is replaced. The Service is a stable name and address, and it balances traffic over the Ready pods.

**`port`, `targetPort`, `nodePort`?** `nodePort` is opened on the node (30080), `port` is the Service's own port (80), `targetPort` is the container's port (4000).

**Readiness vs liveness?** Readiness decides whether the pod gets traffic. Liveness decides whether the container is restarted.

**What is CrashLoopBackOff?** The container keeps exiting; Kubernetes restarts it with an increasing delay. The reason is in `kubectl logs --previous`.

**What happens when you delete a pod?** The Deployment notices one is missing and creates a new one.

**How does the pod get the database password?** From the Secret `readspace-db`, through `secretKeyRef`. The deploy script creates the Secret from `.env`; it is not in Git.

**What happens during `kubectl apply` of a changed Deployment?** A rolling update: new pods are started and must become Ready before old ones are removed, so the application stays available.

**Why can we scale this application freely?** The pods are stateless. All data is in PostgreSQL.

**Why is PostgreSQL only one replica?** A database cannot be scaled by just adding pods on the same volume. Running several would need replication, which is outside this project.

**What does `kubectl describe` show that `logs` does not?** What Kubernetes did: scheduling, image pull, probe results, restarts, exit codes. `logs` shows only what the application printed.

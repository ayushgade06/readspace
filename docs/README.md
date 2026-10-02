# Study material — CIE-01 group assessment

Based on the faculty rubric (*DevOps for Scalable System, Group Classroom CIE-01 Assessment Method & Rubrics*). Read this page first, then your own file.

| Student | Primary tool (9 marks) | Role in the rubric | Also owns | File |
|---------|------------------------|--------------------|-----------|------|
| Kartik | Git | Source Control Owner | Prometheus (architecture, targets); scenarios A and E | [kartik.md](kartik.md) |
| Trushna | GitHub Actions | CI/CD Owner | Prometheus (configuration, queries); scenarios B, A and E | [trushna.md](trushna.md) |
| Ayush | Docker | Containerization Owner | Integration walkthrough; Grafana (dashboard, data source, query); scenarios C and F | [ayush.md](ayush.md) |
| Aarya | Kubernetes | Orchestration Owner | Troubleshooting lead; Grafana (anomaly); scenarios D and F | [aarya.md](aarya.md) |

The rubric leaves Prometheus and Grafana to "group / rotating responsibility". We show them in the integration slot: **Kartik and Trushna explain Prometheus, Ayush and Aarya explain Grafana.** The faculty checklist says Prometheus and Grafana are assessed separately, so each pair must cover all three criteria of its tool (rubric 4.5 and 4.6).

## How the 50 marks are given

| Part | Marks | Who earns it |
|------|-------|--------------|
| Primary tool, 3 criteria of 3 marks each | 9 per student, 36 in total | each student alone |
| Group integration and troubleshooting | 14 | everyone together |

The 14 group marks:

| Criterion | Marks | What we do for it |
|-----------|-------|-------------------|
| End-to-end workflow | 3 | Ayush explains Git -> CI/CD -> Docker -> Kubernetes -> Prometheus -> Grafana in six sentences |
| Live integration | 3 | We show that each stage's output feeds the next (table below) |
| Troubleshooting scenario | 3 | Aarya leads; the owner of the broken tool diagnoses it |
| Team coordination | 3 | Clean handovers, everyone says something technical |
| Final explanation | 2 | Whoever is asked answers; others add one line at most |

## What the faculty is looking for

From the rubric's checklist and its last section:

- Actual configuration and execution, **not only definitions**. Run the command, do not describe it.
- **Verify the result.** After every command, show the output that proves it worked.
- **Explain the purpose** of each command or configuration line.
- The assessment "is not to reward memorization of DevOps commands". They want to see that you own your tool, can explain its role, can verify its output and can take part in troubleshooting.

The rubric's progression is: Configure/Show -> Execute -> Verify -> Troubleshoot -> Explain -> Integrate. Each personal file follows it.

A habit that covers most of this: for every step say three things. **What I am running, what I expect, what the output shows.**

## The one-minute story everyone must be able to tell

> ReadSpace shows which seats in the PICT reading hall are free. The code is on GitHub. Every push starts a GitHub Actions pipeline that runs the tests, builds the application and builds a Docker image. Kubernetes runs that image as two pods behind a Service, with PostgreSQL holding the seats. Each pod exposes its numbers at /metrics. Prometheus collects them every five seconds, and Grafana draws the dashboard from Prometheus.

## Live integration: the evidence that one stage feeds the next

| From -> to | Evidence to point at |
|------------|----------------------|
| Git -> GitHub Actions | Kartik's push appears as a new run in the Actions tab, with his commit message as the title |
| GitHub Actions -> Docker | The job "Docker build and validation" has the step "Build Docker image" and lists `readspace 1.0` |
| Docker -> Kubernetes | `kubectl describe pod` shows `Image: readspace:1.0`, the same tag as `docker images readspace` |
| Kubernetes -> application | `kubectl get endpoints readspace` lists the pod IPs with port 4000, and the page opens |
| Application -> Prometheus | The targets page lists the same pod IPs as `kubectl get pods -o wide`, state UP |
| Prometheus -> Grafana | The value on the "Occupied Seats" panel equals the result of `reading_hall_seats_occupied` in Prometheus and the count on the web page |

## Order of speaking and handovers

Marks for coordination come from handovers that make sense. Use these lines.

| Time | Who | Ends with |
|------|-----|-----------|
| 0:00 | All four: name, tool, role. Then Kartik shows the page and clicks a seat. | |
| 1:00 | Kartik — Git | "My push has just started the pipeline. Trushna will show what it does." |
| 2:10 | Trushna — GitHub Actions | "The last job built the Docker image. Ayush will show that image." |
| 3:20 | Ayush — Docker | "This is one container on my laptop. Aarya will show how Kubernetes runs it as several." |
| 4:30 | Aarya — Kubernetes | "Both pods expose metrics. We will now show the whole chain." |
| 5:40 | Ayush: six-sentence walkthrough | "Kartik and Trushna will show the metrics." |
| 6:00 | Kartik: `/metrics` and the targets page. Trushna: `prometheus.k8s.yml` and two queries. | "Ayush and Aarya will show it in Grafana." |
| 6:30 | Ayush: dashboard, data source, one panel's query. Aarya: `simulate.mjs rush` and the anomaly. | |
| 7:00 | Aarya leads troubleshooting | |
| 9:00 | Viva | |

Exact commands for every slot are in [../DEMO.md](../DEMO.md).

## Troubleshooting: who takes which scenario

These are the six scenarios in section 8 of the rubric. Whatever the fault, use the same order: **status -> logs -> events -> compare with configuration -> fix -> verify.**

| Scenario from the rubric | Owner | First three things to check |
|--------------------------|-------|-----------------------------|
| A. Git push does not trigger CI/CD | Kartik and Trushna | `git remote -v` and the branch; is `.github/workflows/ci.yml` on that branch; the `on:` section and the Actions tab |
| B. CI/CD build fails | Trushna | Which job is red; which step; the first error line in that step's log |
| C. Container runs but application is inaccessible | Ayush | `docker ps` (port mapping); `docker logs` (which port the app listens on); binding address |
| D. Pod is CrashLoopBackOff | Aarya | `kubectl get pods`; `kubectl logs <pod> --previous`; `kubectl describe pod` and events |
| E. Prometheus target is DOWN | Kartik and Trushna | Error text on the targets page; open `/metrics`; `kubectl get pods` and the scrape configuration |
| F. Grafana panel shows no data | Ayush and Aarya | Data source test; time range; run the query in Prometheus |

If the faculty picks a scenario that is not yours, the owner talks and you run the commands or add one observation. Do not stay silent: coordination is marked.

How to produce each failure for practice, and the fix, is in the troubleshooting part of [../DEMO.md](../DEMO.md).

## Setup on the demo laptop

The cluster runs on one laptop (Ayush's). Everyone presents from it.

1. Start Docker Desktop, wait for Kubernetes to show as running.
2. Follow "Before the demo" in [../DEMO.md](../DEMO.md).
3. Keep `scripts\k8s-port-forward.ps1` running in its own terminal. On this laptop the cluster does not publish NodePorts on `localhost`, so without it the three URLs do not open.
4. Close other heavy programs. With little free memory the port-forward and the pods become slow.

Things to arrange before the day:

- Kartik pushes from the demo laptop, so the push is made with Ayush's GitHub login. If Kartik wants to push from his own laptop, Ayush must add him as a collaborator first (repository Settings > Collaborators).
- Ayush signs in to Grafana as `admin` before the demo starts (`GRAFANA_ADMIN_PASSWORD` in `.env` on the demo laptop). Without it a panel's query cannot be opened.

## Practice plan

1. Alone: read your file, run every command in it at least twice, say the explanation out loud.
2. Alone: break your own tool using the steps in DEMO.md and fix it without looking at the notes.
3. Together: one full run with a timer. Cut what does not fit in your 60-90 seconds.
4. Together: each person explains a tool that is **not** theirs for 30 seconds. The viva question can go to anyone.
5. Together: one person causes a failure without telling the others which one.

## What we should say honestly if asked

- **The pipeline does not deploy to Kubernetes.** It builds the image and starts it on the GitHub runner to check it. The cluster is on a laptop, which GitHub cannot reach, so deployment is done with `scripts\k8s-deploy.ps1`. The rubric asks to "demonstrate or explain" the deployment stage; Trushna's file has the explanation.
- **We do not use an exporter.** The application exposes `/metrics` itself with the `prom-client` library.
- **The image is not pushed to a registry.** Docker Desktop's Kubernetes can use images built locally.
- **The page is reached through a port-forward on this laptop**, because of how Docker Desktop's cluster is set up. The NodePort Service is still there and can be shown with `kubectl get services`.

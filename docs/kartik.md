# Kartik — Git (Source Control Owner)

Also yours: Prometheus in the integration slot (shared with Trushna), and troubleshooting scenarios A (push does not trigger CI/CD) and E (Prometheus target is DOWN), both together with Trushna.

Read [README.md](README.md) first for the group part.

## Your 9 marks (rubric 4.1)

| Criterion | Marks | Expected evidence | What you do |
|-----------|-------|-------------------|-------------|
| Commands | 3 | add / commit / push / pull / clone | Run each one live, in a sensible order |
| Branching | 3 | Branch and merge or pull-request workflow | Create a branch, push it, show the merged pull requests |
| Verification and explanation | 3 | Verify the result, explain why version control is required | `git status`, `git log`, the branch on GitHub; two sentences on why Git |

## What you need to understand

**The four places a change can be**

```
working directory  --git add-->  staging area  --git commit-->  local repository  --git push-->  GitHub
                                                                 local repository  <--git pull--  GitHub
```

- *Working directory*: the files you edit.
- *Staging area*: the changes you have chosen for the next commit.
- *Local repository*: the `.git` folder with the full history, on your laptop.
- *Remote (origin)*: the copy on GitHub that the team shares.

**Commands**

| Command | What it does | In our project |
|---------|--------------|----------------|
| `git clone <url>` | Copies the whole repository and its history to a new folder | How each member gets the project |
| `git status` | Shows what changed and what is staged | Run it before and after `add` |
| `git add <file>` | Stages a change | |
| `git commit -m "..."` | Saves the staged changes as a snapshot with a message. Local only. | One commit per milestone |
| `git push` | Sends local commits to GitHub | Also starts the pipeline |
| `git pull` | Fetches new commits from GitHub and merges them into the current branch | After a pull request is merged |
| `git switch -c <name>` | Creates a branch and moves to it | `feature/docker`, `ci/github-actions`, ... |
| `git merge <branch>` | Brings a branch's commits into the current branch | |
| `git log --oneline --graph` | Shows the history as a graph | Shows branches joining `main` |

**Terms**

- *Commit*: a snapshot of the project with an author, a time, a message and a unique hash (for example `a17f042`).
- *Branch*: a movable name pointing at a commit. Work on a branch does not affect `main` until it is merged.
- *Merge*: combining two lines of history. *Merge conflict*: both branches changed the same lines; Git stops and asks you to choose.
- *Pull request*: a request on GitHub to merge a branch into `main`. Others can review it, and the pipeline runs on it before merging.
- *fetch vs pull*: `fetch` only downloads; `pull` downloads and merges.
- *.gitignore*: files Git must not track. Ours ignores `node_modules/`, `dist/` and `.env`, so passwords never reach GitHub. Only `.env.example` is committed.

**Why version control is required** (say this for the third criterion)

> Without Git, four of us would overwrite each other's files and nobody could tell what changed or go back. Git keeps every version, shows who changed what and why, lets each of us work on a separate branch, and gives the pipeline a single source to build from.

**Our workflow**

- `main` always works. Nobody commits to it directly.
- Each piece of work has a branch: `feature/occupancy-api`, `feature/seat-map`, `feature/docker`, `ci/github-actions`, `feature/monitoring`, `feature/kubernetes`.
- Commit messages start with a type: `feat:`, `test:`, `ci:`, `docs:`, `chore:`.
- The first three branches were merged locally with `git merge --no-ff`. The last three were merged through pull requests #1, #2 and #3 on GitHub, after the pipeline passed.

## Your demo (70-90 seconds)

Have two things ready: a terminal in the repository root and the GitHub repository tab.

**1. Clone** (10 s). Clone into a folder next to the project so the audience sees the command work.

```
git clone https://github.com/ayushgade06/readspace.git ..\readspace-clone
```

Say: "clone copies the repository and its whole history from GitHub." Then go back to the project folder.

**2. History and branches** (15 s)

```
git log --oneline --graph -12
git branch -a
```

Point at: one commit per milestone, the lines where branches join `main`, the `Merge pull request #3` line.

**3. Branch, add, commit, push** (35 s). Create the branch, add one line such as `Demo run: CIE-01` at the end of `README.md` in the editor, save, then:

```
git switch -c demo/readme-note
git status
git add README.md
git commit -m "docs: add demo note"
git push -u origin demo/readme-note
```

Say one line per command: switch creates the branch, status shows the modified file, add stages it, commit saves it locally, push sends it to GitHub.

**4. Verify** (15 s)

```
git status
git log --oneline -1
```

Point at: "nothing to commit, working tree clean" and "up to date with origin". Then refresh the GitHub tab: the branch `demo/readme-note` is there with a "Compare & pull request" button. Open the Actions tab: a new run with your commit message has started.

**5. Pull and merge** (10 s)

```
git switch main
git pull
```

Say: "Changes reach main through a pull request. After it is merged on GitHub, everyone runs git pull to get it." Show the Pull requests tab > Closed: three merged pull requests.

Hand over: "My push has just started the pipeline. Trushna will show what it does."

**After the demo**, clean up (PowerShell):

```
git branch -D demo/readme-note
git push origin --delete demo/readme-note
Remove-Item -Recurse -Force ..\readspace-clone
```

**If something goes wrong**

| Problem | What to do |
|---------|------------|
| `branch 'demo/readme-note' already exists` | It was left from practice. Run the clean-up commands above first, or use another name. |
| `nothing to commit` | The file was not saved in the editor. |
| Push asks for a login or is rejected | You are on a laptop without access. Use the demo laptop, or get added as a collaborator beforehand. |
| Clone folder already exists | Delete it or clone to another folder name. |

## Your part in the integration slot: Prometheus architecture and targets (about 25 seconds)

Prometheus is shared with Trushna. The rubric's Prometheus criteria are: explain the architecture (targets, exporters), explain `prometheus.yml`, verify target status and run a query. **You open with the architecture and the targets. Trushna continues with the configuration file and the queries.**

1. Open `http://localhost:30080/metrics`. Point at `reading_hall_seats_occupied`. Say: "The application publishes its numbers here as plain text. We need no exporter, because the application does this itself."
2. Open `http://localhost:30090/targets`. Point at job `readspace`, two endpoints, state **UP**. Say: "A target is one address Prometheus scrapes. There is one per pod. Scraping means Prometheus sends GET /metrics every five seconds and stores the answer. UP means the last scrape worked."

Hand over: "Trushna will show how Prometheus knows where the pods are."

What to know (you and Trushna should both be able to answer all of this, including her part: the file and the queries):

- **Pull model**: Prometheus fetches the metrics; the application does not send them.
- **Configuration**: `monitoring/prometheus/prometheus.k8s.yml`. `scrape_interval: 5s` says how often. The job `readspace` has `metrics_path: /metrics` and `dns_sd_configs` pointing at `readspace-pods.default.svc.cluster.local`, a headless Service whose DNS name returns the IP of every pod. For Docker Compose the file is `prometheus.yml` with a fixed target `app:4000`.
- **Exporter**: a separate program that publishes metrics for software that cannot do it itself, for example node_exporter for a machine. We do not need one: the application publishes `/metrics` itself with the `prom-client` library.
- **Metric types**: gauge goes up and down (`reading_hall_seats_occupied`); counter only goes up (`http_requests_total`), so we query its `rate`; histogram counts observations in buckets (`http_request_duration_seconds`).
- **Queries**: `reading_hall_seats_occupied`, `reading_hall_seats_available`, `reading_hall_occupancy_ratio`, `rate(http_requests_total[1m])`, `sum by (status) (rate(http_requests_total[1m]))`, `up{job="readspace"}`.

## Troubleshooting you lead

**A. Git push does not trigger CI/CD** (with Trushna)

You check the repository and branch (steps 1-2); Trushna checks the workflow side (steps 3-6).

1. `git remote -v` and `git branch --show-current`: was the push made to the right repository and branch?
2. `git log origin/<branch> --oneline -1`: did the commit actually reach GitHub?
3. Is `.github/workflows/ci.yml` present on that branch? The folder name and the `.yml` extension must be exact.
4. Actions tab: a workflow with a YAML mistake is listed with an error instead of running.
5. The `on:` section: ours has `push:` for all branches. If it had `branches: [main]`, a push to another branch would not start it.
6. Repository Settings > Actions: Actions must be enabled.

**E. Prometheus target is DOWN** (with Trushna)

1. Targets page: read the error next to the target (`connection refused`, `context deadline exceeded`, `server returned HTTP status 404`).
2. Open the application's `/metrics` in the browser: does it answer?
3. `kubectl get pods -o wide`: is the pod with that IP running, or is it crashing?
4. `kubectl get endpoints readspace-pods`: does the headless Service list the pods with port 4000?
5. Compare with `prometheus.k8s.yml`: Service name, port 4000, path `/metrics`.

In our practice case the target is DOWN because the pod is in CrashLoopBackOff, so nothing listens on its port. Fixing the pod fixes the target.

## Other tools: the minimum you must know

- **GitHub Actions**: `.github/workflows/ci.yml` runs on every push and pull request. Three jobs: Test (API tests with a PostgreSQL container), Build (backend and frontend), Docker build and validation (builds the image and checks a running container). The third waits for the first two.
- **Docker**: an image is the packaged application; a container is a running copy. Our Dockerfile has three stages and produces `readspace:1.0`, listening on port 4000.
- **Kubernetes**: a Deployment keeps two pods of that image running. A Service gives them one address. Readiness probe calls `/health`. Diagnose with `kubectl get`, `logs`, `describe`, `get events`.
- **Grafana**: reads from Prometheus and draws seven panels; it stores no metrics itself. If Prometheus is down, every panel is empty. Ayush and Aarya present it.

## Viva questions

**Why Git and not a shared folder?** History, authorship, branches for parallel work, and the ability to go back. Also the pipeline needs one source of truth.

**Difference between commit and push?** Commit saves to the local repository. Push sends local commits to GitHub.

**Difference between `git pull` and `git clone`?** Clone makes a new copy of a repository. Pull updates an existing copy.

**What is a merge conflict and how do you solve it?** Two branches changed the same lines. Git marks both versions in the file; you edit it to the correct content, `git add` it and commit.

**Why branches instead of committing to main?** `main` stays working, and the pipeline checks a change before it is merged.

**What is in `.gitignore` and why?** `node_modules`, build output and `.env`. They are either generated or secret.

**How is Git connected to the next stage?** A push is the event that starts the GitHub Actions workflow.

**What does `-u` in `git push -u origin <branch>` do?** It links the local branch to the remote one, so later `git push` and `git pull` need no arguments.

**How would you undo a bad commit that is already pushed?** `git revert <hash>`: it adds a new commit that reverses it, so history is not rewritten.

**What is a scrape target?** One address that Prometheus collects metrics from. We have one per pod.

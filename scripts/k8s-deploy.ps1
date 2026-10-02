# Deploys ReadSpace to the local Kubernetes cluster (Docker Desktop).
#
#   powershell -ExecutionPolicy Bypass -File scripts\k8s-deploy.ps1
#
# The script only runs ordinary kubectl commands, in this order:
#   1. Secrets     - passwords, read from .env (never stored in the repository)
#   2. ConfigMaps  - Prometheus and Grafana configuration files from monitoring/
#   3. Database    - k8s/postgres.yaml, and wait until it is ready
#   4. Manifests   - everything else in k8s/
# It can be run again at any time; existing objects are updated.

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "No .env file found. Copy .env.example to .env and set the passwords first."
    exit 1
}

# Read KEY=VALUE lines from .env
$settings = @{}
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)$') {
        $settings[$Matches[1]] = $Matches[2].Trim()
    }
}

foreach ($key in "DB_PASSWORD", "GRAFANA_ADMIN_PASSWORD") {
    if (-not $settings[$key]) {
        Write-Host "$key is not set in .env"
        exit 1
    }
}

# "create --dry-run=client -o yaml | kubectl apply" creates the object if it
# is missing and updates it if it already exists.
function Apply-Generated {
    $yaml = kubectl create @args --dry-run=client -o yaml
    if ($LASTEXITCODE -ne 0) { exit 1 }
    $yaml | kubectl apply -f -
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host "`n== Secrets =="
Apply-Generated secret generic readspace-db "--from-literal=DB_PASSWORD=$($settings['DB_PASSWORD'])"
Apply-Generated secret generic readspace-grafana "--from-literal=GRAFANA_ADMIN_PASSWORD=$($settings['GRAFANA_ADMIN_PASSWORD'])"

Write-Host "`n== ConfigMaps from monitoring/ =="
Apply-Generated configmap prometheus-config "--from-file=$root\monitoring\prometheus\prometheus.k8s.yml"
Apply-Generated configmap grafana-datasources "--from-file=$root\monitoring\grafana\provisioning\datasources"
Apply-Generated configmap grafana-dashboard-provider "--from-file=$root\monitoring\grafana\provisioning\dashboards"
Apply-Generated configmap grafana-dashboards "--from-file=$root\monitoring\grafana\dashboards"

# The database goes first, so the application does not have to wait for it.
Write-Host "`n== Database =="
kubectl apply -f "$root\k8s\postgres.yaml"
if ($LASTEXITCODE -ne 0) { exit 1 }
kubectl rollout status deployment/postgres --timeout=300s

Write-Host "`n== Manifests in k8s/ =="
kubectl apply -f "$root\k8s"
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n== Waiting for the pods =="
kubectl rollout status deployment/readspace --timeout=180s
kubectl rollout status deployment/prometheus --timeout=180s
kubectl rollout status deployment/grafana --timeout=180s

Write-Host "`nReadSpace   http://localhost:30080"
Write-Host "Prometheus  http://localhost:30090"
Write-Host "Grafana     http://localhost:30030"

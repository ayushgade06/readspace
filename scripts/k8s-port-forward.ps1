# Fallback for clusters that do not publish NodePorts on localhost
# (Docker Desktop with the "kind" provisioner, Minikube).
#
#   powershell -ExecutionPolicy Bypass -File scripts\k8s-port-forward.ps1
#
# Forwards the same three local ports the NodePorts would use, so every
# URL in the documentation stays the same. Press Ctrl+C to stop.
#
# A port-forward is tied to one pod. If that pod is replaced (for example
# during a rollout), the forward is started again automatically.

$forwards = @(
    @{ Name = "ReadSpace";  Target = "service/readspace";  Ports = "30080:80" },
    @{ Name = "Prometheus"; Target = "service/prometheus"; Ports = "30090:9090" },
    @{ Name = "Grafana";    Target = "service/grafana";    Ports = "30030:3000" }
)

$jobs = foreach ($f in $forwards) {
    Start-Job -ArgumentList $f.Target, $f.Ports -ScriptBlock {
        param($target, $ports)
        while ($true) {
            kubectl port-forward $target $ports 2>&1 | Out-Null
            Start-Sleep -Seconds 1
        }
    }
}

Write-Host "ReadSpace   http://localhost:30080"
Write-Host "Prometheus  http://localhost:30090"
Write-Host "Grafana     http://localhost:30030"
Write-Host "Forwarding. Press Ctrl+C to stop."

try {
    Wait-Job $jobs | Out-Null
} finally {
    $jobs | Stop-Job
    $jobs | Remove-Job
}

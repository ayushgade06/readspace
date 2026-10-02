// Generates real activity against the ReadSpace API so that a change is
// visible on the Grafana dashboard. Nothing is faked: the script only
// calls the same endpoints the web page uses.
//
//   node scripts/simulate.mjs rush   [url]   occupy every free seat, one after another
//   node scripts/simulate.mjs clear  [url]   release every occupied seat
//   node scripts/simulate.mjs errors [url]   send requests that are rejected (409 / 404)
//
// The default url is http://localhost:30080 (the Kubernetes NodePort).
// For Docker Compose or local development use http://localhost:4000.

const mode = process.argv[2];
const baseUrl = (process.argv[3] ?? "http://localhost:30080").replace(/\/$/, "");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, path) {
  const response = await fetch(baseUrl + path, { method });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function changeAll(fromStatus, action) {
  const seats = (await call("GET", "/api/seats")).body.filter((s) => s.status === fromStatus);
  console.log(`${seats.length} seats to ${action}`);
  for (const seat of seats) {
    const result = await call("POST", `/api/seats/${seat.id}/${action}`);
    console.log(`seat ${String(seat.seatNumber).padStart(2, "0")} ${action} -> HTTP ${result.status}`);
    await pause(150);
  }
}

async function sendRejectedRequests() {
  // Seat 1 is occupied first, so every further occupy request for it is
  // answered with 409. Seat 9999 does not exist, which gives 404.
  await call("POST", "/api/seats/1/occupy");
  for (let i = 1; i <= 60; i++) {
    const path = i % 2 === 0 ? "/api/seats/1/occupy" : "/api/seats/9999/occupy";
    const result = await call("POST", path);
    console.log(`request ${i}: POST ${path} -> HTTP ${result.status}`);
    await pause(100);
  }
}

try {
  if (mode === "rush") await changeAll("available", "occupy");
  else if (mode === "clear") await changeAll("occupied", "release");
  else if (mode === "errors") await sendRejectedRequests();
  else {
    console.log("Usage: node scripts/simulate.mjs <rush|clear|errors> [url]");
    process.exit(1);
  }
  const stats = (await call("GET", "/api/stats")).body;
  console.log(`Done. Occupied ${stats.occupied} of ${stats.total} (${stats.occupancyPercentage}%).`);
} catch (err) {
  console.error(`Could not reach ${baseUrl}: ${err.message}`);
  process.exit(1);
}

import { createApp } from "./app";

const port = Number(process.env.PORT) || 4000;

// Bind to 0.0.0.0 so the server is reachable from outside a container.
createApp().listen(port, "0.0.0.0", () => {
  console.log(`ReadSpace API listening on port ${port}`);
});

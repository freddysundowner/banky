import { spawn } from "child_process";

const isDev = process.env.NODE_ENV === "development";

console.log("Starting Python backend on port 8000...");
const py = spawn("python", ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"], {
  cwd: `${process.cwd()}/python_backend`,
  stdio: "inherit",
  env: process.env
});

py.on("error", (e) => { console.error(e); process.exit(1); });

if (isDev) {
  console.log("Starting Vite dev server on port 5000...");
  const vite = spawn("npx", ["vite", "--host", "0.0.0.0", "--port", "5000"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env
  });

  vite.on("error", (e) => { console.error(e); process.exit(1); });
  vite.on("close", (c) => { py.kill("SIGTERM"); process.exit(c || 0); });

  process.on("SIGTERM", () => { vite.kill("SIGTERM"); py.kill("SIGTERM"); });
  process.on("SIGINT", () => { vite.kill("SIGINT"); py.kill("SIGINT"); });
} else {
  py.on("close", (c) => process.exit(c || 0));
  process.on("SIGTERM", () => py.kill("SIGTERM"));
  process.on("SIGINT", () => py.kill("SIGINT"));
}

const path = require("path");
const fs = require("fs");

const rootDir = __dirname;
const envPath = path.join(rootDir, ".env");
const envVars = {};

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        envVars[key] = val;
      }
    }
  }
}

const port = envVars.PORT || "5000";

module.exports = {
  apps: [
    {
      name: "banky",
      cwd: rootDir,
      script: "./venv/bin/uvicorn",
      args: `main:app --host 0.0.0.0 --port ${port} --workers 2 --app-dir python_backend`,
      env: {
        ...envVars,
        NODE_ENV: "production",
      },
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: path.join(rootDir, "logs", "banky-error.log"),
      out_file: path.join(rootDir, "logs", "banky-out.log"),
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "banky-scheduler",
      cwd: path.join(rootDir, "python_backend"),
      script: path.join(rootDir, "venv", "bin", "python3"),
      args: "scheduler.py",
      env: {
        ...envVars,
        NODE_ENV: "production",
      },
      max_memory_restart: "200M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: path.join(rootDir, "logs", "scheduler-error.log"),
      out_file: path.join(rootDir, "logs", "scheduler-out.log"),
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 5,
      restart_delay: 10000,
      cron_restart: "0 */6 * * *",
    },
  ],
};

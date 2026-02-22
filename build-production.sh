#!/bin/bash

set -e

echo "========================================"
echo "  BANKY Production Build Script"
echo "========================================"
echo ""

show_menu() {
    echo "Select build type:"
    echo "  1) SaaS Build (for your cloud deployment)"
    echo "  2) Enterprise Build (end-user self-hosting)"
    echo "  3) CodeCanyon Package (source code + installer for buyers)"
    echo "  4) Build All"
    echo "  5) Exit"
    echo ""
    read -p "Enter choice [1-5]: " choice
}

build_frontend() {
    echo ""
    echo ">>> Installing frontend dependencies..."
    npm install --silent 2>/dev/null || npm install
    echo ""
    echo ">>> Building Frontend..."
    npx vite build
    echo ">>> Frontend built to dist/public/"
}

build_admin() {
    echo ""
    echo ">>> Building Admin Panel..."
    cd admin-client
    npm run build
    cd ..
    echo ">>> Admin panel built to admin-client/dist/"
}

build_saas() {
    echo ""
    echo "========================================"
    echo "  Building SaaS Version"
    echo "========================================"
    
    build_frontend
    build_admin
    
    echo ""
    echo ">>> Creating SaaS deployment package..."
    
    rm -rf packages/saas
    mkdir -p packages/saas
    
    cp -r dist/public packages/saas/frontend
    cp -r admin-client/dist packages/saas/admin
    cp -r python_backend packages/saas/backend
    cp -r shared packages/saas/shared 2>/dev/null || true
    
    rm -rf packages/saas/backend/__pycache__
    find packages/saas/backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find packages/saas/backend -type f -name "*.pyc" -delete 2>/dev/null || true
    rm -rf packages/saas/backend/uploads 2>/dev/null || true
    rm -rf packages/saas/backend/tests 2>/dev/null || true
    
    cat > packages/saas/.env.example << 'EOF'
# Database connection
DATABASE_URL=postgresql://user:password@host:5432/banky_master

# Deployment mode (saas = multi-tenant platform)
DEPLOYMENT_MODE=saas

# Neon API key (required for SaaS - provisions databases for each organization)
NEON_API_KEY=your-neon-api-key
EOF

    cat > packages/saas/ecosystem.config.js << 'PMEOF'
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
        envVars[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
      }
    }
  }
}

module.exports = {
  apps: [
    {
      name: "banky-api",
      cwd: path.join(rootDir, "backend"),
      script: "uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 2",
      interpreter: "python3",
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "500M",
      autorestart: true,
    },
    {
      name: "banky-scheduler",
      cwd: path.join(rootDir, "backend"),
      script: "python3",
      args: "scheduler.py",
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "200M",
      autorestart: true,
      cron_restart: "0 */6 * * *",
    }
  ],
};
PMEOF

    cp docs/README-saas.md packages/saas/README.md

    echo ">>> SaaS build complete: packages/saas/"
}

build_compiled() {
    echo ""
    echo "========================================"
    echo "  Building Enterprise Version"
    echo "========================================"
    echo ""
    echo "Note: Enterprise is an end-user package (no admin panel, no landing page)."
    echo "      License key must be generated from your SaaS admin panel."
    
    build_frontend
    
    echo ""
    echo ">>> Creating Enterprise source package..."
    
    rm -rf packages/enterprise
    mkdir -p packages/enterprise/banky
    
    # Copy only end-user source code (no admin-client, no landing-page)
    cp -r client packages/enterprise/banky/
    cp -r python_backend packages/enterprise/banky/
    cp -r server packages/enterprise/banky/
    cp -r shared packages/enterprise/banky/ 2>/dev/null || true
    cp package.json packages/enterprise/banky/
    cp package-lock.json packages/enterprise/banky/ 2>/dev/null || true
    cp vite.config.ts packages/enterprise/banky/
    cp tsconfig.json packages/enterprise/banky/
    cp tailwind.config.ts packages/enterprise/banky/ 2>/dev/null || true
    cp postcss.config.js packages/enterprise/banky/ 2>/dev/null || true
    
    # Clean up unnecessary files
    find packages/enterprise/banky -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
    find packages/enterprise/banky -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find packages/enterprise/banky -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true
    find packages/enterprise/banky -type f -name "*.pyc" -delete 2>/dev/null || true
    find packages/enterprise/banky -type f -name ".env" -delete 2>/dev/null || true
    find packages/enterprise/banky -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
    find packages/enterprise/banky -name ".DS_Store" -delete 2>/dev/null || true
    rm -rf packages/enterprise/banky/python_backend/tests 2>/dev/null || true
    rm -rf packages/enterprise/banky/python_backend/uploads 2>/dev/null || true
    rm -f packages/enterprise/banky/drizzle.config.ts 2>/dev/null || true
    rm -f packages/enterprise/banky/components.json 2>/dev/null || true
    
    cat > packages/enterprise/banky/.env.example << 'EOF'
# Database connection
DATABASE_URL=postgresql://user:password@host:5432/banky

# Deployment mode (do not change)
DEPLOYMENT_MODE=enterprise

# Random secret for session encryption (minimum 32 characters)
# Generate with: openssl rand -hex 32
SESSION_SECRET=change-this-to-a-random-string-at-least-32-characters

# Application port (default: 5000)
PORT=5000
EOF

    # Use the repo install.sh so updates are always reflected in the package
    cp install.sh packages/enterprise/banky/install.sh
    chmod +x packages/enterprise/banky/install.sh

    # Create start script (development mode)
    cat > packages/enterprise/banky/start.sh << 'STARTSCRIPT'
#!/bin/bash

echo "Starting BANKY (development mode)..."
echo ""

# Start Python backend
cd python_backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Start scheduler
cd python_backend
python3 scheduler.py &
SCHEDULER_PID=$!
cd ..

# Start main frontend dev server
npx vite --host 0.0.0.0 --port 5000 &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  BANKY is running!"
echo "========================================"
echo ""
echo "  App: http://localhost:5000"
echo "  API: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

trap "kill $BACKEND_PID $SCHEDULER_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
STARTSCRIPT
    chmod +x packages/enterprise/banky/start.sh

    # Create ecosystem.config.js for production (PM2)
    cat > packages/enterprise/banky/ecosystem.config.js << 'PMEOF'
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
        envVars[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
      }
    }
  }
}

module.exports = {
  apps: [
    {
      name: "banky-api",
      cwd: path.join(rootDir, "python_backend"),
      script: "uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 2",
      interpreter: "python3",
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "500M",
      autorestart: true,
    },
    {
      name: "banky-scheduler",
      cwd: path.join(rootDir, "python_backend"),
      script: "python3",
      args: "scheduler.py",
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "200M",
      autorestart: true,
      cron_restart: "0 */6 * * *",
    }
  ],
};
PMEOF

    echo ">>> Enterprise build complete: packages/enterprise/"
}

build_codecanyon() {
    echo ""
    echo "========================================"
    echo "  Building CodeCanyon Package"
    echo "========================================"
    echo ""
    echo ">>> Packaging source code for CodeCanyon..."
    echo "    (No build needed - buyers run install.sh on their server)"
    
    rm -rf packages/codecanyon
    mkdir -p packages/codecanyon/banky
    
    cp -r client packages/codecanyon/banky/
    cp -r python_backend packages/codecanyon/banky/
    cp -r server packages/codecanyon/banky/
    cp -r shared packages/codecanyon/banky/ 2>/dev/null || true
    cp package.json packages/codecanyon/banky/
    cp package-lock.json packages/codecanyon/banky/ 2>/dev/null || true
    cp vite.config.ts packages/codecanyon/banky/
    cp tsconfig.json packages/codecanyon/banky/
    cp tailwind.config.ts packages/codecanyon/banky/ 2>/dev/null || true
    cp postcss.config.js packages/codecanyon/banky/ 2>/dev/null || true
    
    find packages/codecanyon/banky -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/banky -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/banky -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/banky -type f -name "*.pyc" -delete 2>/dev/null || true
    find packages/codecanyon/banky -type f -name ".env" -delete 2>/dev/null || true
    find packages/codecanyon/banky -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/banky -name ".DS_Store" -delete 2>/dev/null || true
    rm -rf packages/codecanyon/banky/python_backend/tests 2>/dev/null || true
    rm -rf packages/codecanyon/banky/python_backend/uploads 2>/dev/null || true
    rm -f packages/codecanyon/banky/drizzle.config.ts 2>/dev/null || true
    rm -f packages/codecanyon/banky/components.json 2>/dev/null || true
    
    cat > packages/codecanyon/banky/.env.example << 'EOF'
# ═══════════════════════════════════════════════════════════════════
#  BANKY - Bank & Sacco Management System
#  Environment Configuration
# ═══════════════════════════════════════════════════════════════════

# PostgreSQL connection string (auto-configured by install.sh)
DATABASE_URL=postgresql://banky:banky_secure_2024@localhost:5432/banky

# Deployment mode (do not change)
DEPLOYMENT_MODE=enterprise

# Random secret for session encryption
SESSION_SECRET=CHANGE_ME

# Your domain (set by install.sh)
DOMAIN=localhost

# Application port
PORT=5000
EOF

    # Use the repo install.sh so updates are always reflected in the package
    cp install.sh packages/codecanyon/banky/install.sh
    chmod +x packages/codecanyon/banky/install.sh

    # ── start.sh: Cross-platform dev start script ──
    cat > packages/codecanyon/banky/start.sh << 'STARTSCRIPT'
#!/bin/bash

APP_DIR=$(pwd)

echo ""
echo "  Starting BANKY..."
echo ""

# Find python in venv
PYTHON_CMD=""
if [ -f "venv/bin/python3" ]; then
    PYTHON_CMD="venv/bin/python3"
elif [ -f "venv/Scripts/python.exe" ]; then
    PYTHON_CMD="venv/Scripts/python.exe"
elif [ -f "venv/bin/python" ]; then
    PYTHON_CMD="venv/bin/python"
else
    PYTHON_CMD=$(command -v python3 || command -v python)
fi

# Start Python backend
echo "  Starting API server on port 8000..."
$PYTHON_CMD -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --app-dir python_backend &
BACKEND_PID=$!

# Start scheduler
echo "  Starting scheduler..."
cd python_backend && $PYTHON_CMD scheduler.py &
SCHEDULER_PID=$!
cd "$APP_DIR"

# Start frontend dev server
echo "  Starting frontend on port 5000..."
npx vite --host 0.0.0.0 --port 5000 &
FRONTEND_PID=$!

echo ""
echo "  ========================================"
echo "  BANKY is running!"
echo "  ========================================"
echo ""
echo "  App: http://localhost:5000"
echo "  API: http://localhost:8000"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

trap "kill $BACKEND_PID $SCHEDULER_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
STARTSCRIPT
    chmod +x packages/codecanyon/banky/start.sh

    # ── ecosystem.config.js for PM2 production setup ──
    cat > packages/codecanyon/banky/ecosystem.config.js << 'PMEOF'
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
        envVars[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
      }
    }
  }
}

module.exports = {
  apps: [
    {
      name: "banky-api",
      cwd: path.join(rootDir, "python_backend"),
      script: "uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 2",
      interpreter: path.join(rootDir, "venv", "bin", "python3"),
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "500M",
      autorestart: true,
    },
    {
      name: "banky-scheduler",
      cwd: path.join(rootDir, "python_backend"),
      script: "scheduler.py",
      interpreter: path.join(rootDir, "venv", "bin", "python3"),
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "200M",
      autorestart: true,
      cron_restart: "0 */6 * * *",
    }
  ],
};
PMEOF

    echo ">>> CodeCanyon build complete: packages/codecanyon/"

    # Zip the package
    cd packages/codecanyon
    zip -r banky-v1.0.0.zip banky
    cd ../..
    
    echo ">>> ZIP package: packages/codecanyon/banky-v1.0.0.zip"
}

cleanup() {
    echo ""
    echo ">>> Cleaning up temporary files..."
    rm -rf python_backend/build python_backend/dist python_backend/*.spec 2>/dev/null || true
    rm -f python_backend/banky_server.py 2>/dev/null || true
}

show_menu

case $choice in
    1)
        build_saas
        ;;
    2)
        build_compiled
        ;;
    3)
        build_codecanyon
        ;;
    4)
        build_saas
        build_compiled
        build_codecanyon
        ;;
    5)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

cleanup

echo ""
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Build outputs:"
[ -d "packages/saas" ] && echo "  - SaaS:       packages/saas/"
[ -d "packages/enterprise" ] && echo "  - Enterprise: packages/enterprise/"
[ -d "packages/codecanyon" ] && echo "  - CodeCanyon: packages/codecanyon/"
[ -f "packages/codecanyon/banky-v1.0.0.zip" ] && echo "                packages/codecanyon/banky-v1.0.0.zip"
echo ""

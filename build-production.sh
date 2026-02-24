#!/bin/bash

set -e

echo "========================================"
echo "  BankyKit Production Build Script"
echo "========================================"
echo ""

show_menu() {
    echo "Select build type:"
    echo "  1) CodeCanyon Package (source code + installer for buyers)"
    echo "  2) Admin Panel        (source code + installer)"
    echo "  3) Landing Page       (source code + installer)"
    echo "  4) Build All"
    echo "  5) Exit"
    echo ""
    read -p "Enter choice [1-5]: " choice
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
    mkdir -p packages/codecanyon/bankykit
    
    cp -r client packages/codecanyon/bankykit/
    cp -r python_backend packages/codecanyon/bankykit/
    cp -r server packages/codecanyon/bankykit/
    cp -r shared packages/codecanyon/bankykit/ 2>/dev/null || true
    cp package.json packages/codecanyon/bankykit/
    cp package-lock.json packages/codecanyon/bankykit/ 2>/dev/null || true
    cp vite.config.ts packages/codecanyon/bankykit/
    cp tsconfig.json packages/codecanyon/bankykit/
    cp tailwind.config.ts packages/codecanyon/bankykit/ 2>/dev/null || true
    cp postcss.config.js packages/codecanyon/bankykit/ 2>/dev/null || true
    
    find packages/codecanyon/bankykit -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/bankykit -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/bankykit -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/bankykit -type f -name "*.pyc" -delete 2>/dev/null || true
    find packages/codecanyon/bankykit -type f -name ".env" -delete 2>/dev/null || true
    find packages/codecanyon/bankykit -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/bankykit -name ".DS_Store" -delete 2>/dev/null || true
    rm -rf packages/codecanyon/bankykit/python_backend/tests 2>/dev/null || true
    rm -rf packages/codecanyon/bankykit/python_backend/uploads 2>/dev/null || true
    rm -f packages/codecanyon/bankykit/drizzle.config.ts 2>/dev/null || true
    rm -f packages/codecanyon/bankykit/components.json 2>/dev/null || true
    
    cat > packages/codecanyon/bankykit/.env.example << 'EOF'
# ═══════════════════════════════════════════════════════════════════
#  BankyKit - Bank & Sacco Management System
#  Environment Configuration
# ═══════════════════════════════════════════════════════════════════

# PostgreSQL connection string (auto-configured by install.sh)
# Local:  postgresql:///bankykit
# Remote: postgresql://user:pass@host:5432/dbname?sslmode=require
DATABASE_URL=postgresql:///bankykit

# Deployment mode (do not change)
DEPLOYMENT_MODE=enterprise

# Production mode: "demo" prefills login with demo credentials
# Set to blank or remove for normal production use
VITE_PRODUCTION_MODE=

# Random secret for session encryption (minimum 32 characters)
# Generate with: openssl rand -hex 32
SESSION_SECRET=CHANGE_ME

# Your domain (set by install.sh)
DOMAIN=localhost

# Application port (default: 5000)
PORT=5000
EOF

    cp install.sh packages/codecanyon/bankykit/install.sh
    chmod +x packages/codecanyon/bankykit/install.sh

    sed 's/bankykit/bankykit-demo/g' install.sh > packages/codecanyon/bankykit/install-demo.sh
    chmod +x packages/codecanyon/bankykit/install-demo.sh

    cp start.sh packages/codecanyon/bankykit/start.sh
    chmod +x packages/codecanyon/bankykit/start.sh

    cat > packages/codecanyon/bankykit/ecosystem.config.cjs << 'PMEOF'
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
      name: "bankykit-api",
      cwd: path.join(rootDir, "python_backend"),
      script: path.join(rootDir, "venv", "bin", "python3"),
      args: `-m uvicorn main:app --host 0.0.0.0 --port ${envVars.PORT || 8000} --workers 2`,
      interpreter: "none",
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "500M",
      autorestart: true,
    },
    {
      name: "bankykit-scheduler",
      cwd: path.join(rootDir, "python_backend"),
      script: path.join(rootDir, "venv", "bin", "python3"),
      args: "scheduler.py",
      interpreter: "none",
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "200M",
      autorestart: true,
      cron_restart: "0 */6 * * *",
    }
  ],
};
PMEOF

    cat > packages/codecanyon/bankykit/ecosystem-demo.config.cjs << 'PMEOF'
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
      name: "bankykit-demo-api",
      cwd: path.join(rootDir, "python_backend"),
      script: path.join(rootDir, "venv", "bin", "python3"),
      args: "-m uvicorn main:app --host 0.0.0.0 --port 6000 --workers 2",
      interpreter: "none",
      env: { ...envVars, NODE_ENV: "production", PORT: "6000" },
      max_memory_restart: "500M",
      autorestart: true,
    },
    {
      name: "bankykit-demo-scheduler",
      cwd: path.join(rootDir, "python_backend"),
      script: path.join(rootDir, "venv", "bin", "python3"),
      args: "scheduler.py",
      interpreter: "none",
      env: { ...envVars, NODE_ENV: "production", PORT: "6000" },
      max_memory_restart: "200M",
      autorestart: true,
      cron_restart: "0 */6 * * *",
    }
  ],
};
PMEOF

    echo ">>> CodeCanyon build complete: packages/codecanyon/"

    cd packages/codecanyon
    zip -r bankykit-v1.0.0.zip bankykit
    cd ../..
    
    echo ">>> ZIP package: packages/codecanyon/bankykit-v1.0.0.zip"
}

build_admin_panel() {
    echo ""
    echo "========================================"
    echo "  Packaging Admin Panel (source code)"
    echo "========================================"
    echo "    (No build needed - run install.sh on your server)"

    rm -rf packages/admin-panel
    mkdir -p packages/admin-panel/bankykit-admin

    cp -r admin-client/src       packages/admin-panel/bankykit-admin/
    cp    admin-client/index.html packages/admin-panel/bankykit-admin/
    cp    admin-client/package.json packages/admin-panel/bankykit-admin/
    cp    admin-client/package-lock.json packages/admin-panel/bankykit-admin/ 2>/dev/null || true
    cp    admin-client/vite.config.ts packages/admin-panel/bankykit-admin/
    cp    admin-client/tsconfig.json packages/admin-panel/bankykit-admin/
    cp    admin-client/tsconfig.node.json packages/admin-panel/bankykit-admin/ 2>/dev/null || true
    cp    admin-client/tailwind.config.js packages/admin-panel/bankykit-admin/ 2>/dev/null || true
    cp    admin-client/postcss.config.js packages/admin-panel/bankykit-admin/ 2>/dev/null || true

    find packages/admin-panel/bankykit-admin -name ".DS_Store" -delete 2>/dev/null || true

    cat > packages/admin-panel/bankykit-admin/ecosystem.config.cjs << 'ECOEOF'
const path = require("path");

const rootDir = __dirname;

module.exports = {
  domain: "admin.bankykit.com",
  port: 5002,
  backend_port: 5000,

  apps: [
    {
      name: "bankykit-admin",
      cwd: rootDir,
      script: "server.cjs",
      env: { NODE_ENV: "production" },
      autorestart: true,
    },
  ],
};
ECOEOF

    cat > packages/admin-panel/bankykit-admin/ecosystem-demo.config.cjs << 'ECOEOF'
const path = require("path");

const rootDir = __dirname;

module.exports = {
  domain: "demoadmin.bankykit.com",
  port: 6002,
  backend_port: 6000,

  apps: [
    {
      name: "bankykit-demo-admin",
      cwd: rootDir,
      script: "server.cjs",
      env: { NODE_ENV: "production", PORT: "6002", BACKEND_PORT: "6000" },
      autorestart: true,
    },
  ],
};
ECOEOF

    cat > packages/admin-panel/bankykit-admin/server.cjs << 'SERVEREOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./ecosystem.config.cjs');

const PORT = process.env.PORT || config.port || 5002;
const BACKEND_PORT = process.env.BACKEND_PORT || config.backend_port || 8000;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const opts = {
      hostname: '127.0.0.1', port: BACKEND_PORT,
      path: req.url, method: req.method, headers: req.headers,
    };
    const proxy = http.request(opts, (back) => {
      res.writeHead(back.statusCode, back.headers);
      back.pipe(res);
    });
    proxy.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend not reachable on port ' + BACKEND_PORT }));
    });
    req.pipe(proxy);
    return;
  }
  const urlPath = req.url.split('?')[0].split('#')[0];
  if (!urlPath.startsWith('/admin') && !urlPath.startsWith('/api/')) {
    res.writeHead(302, { Location: '/admin' + (urlPath === '/' ? '/' : urlPath) });
    res.end();
    return;
  }
  const filePath = urlPath.startsWith('/admin') ? (urlPath.slice('/admin'.length) || '/') : urlPath;
  let file = path.join(DIST_DIR, filePath === '/' ? 'index.html' : filePath);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST_DIR, 'index.html');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('BankyKit Admin Panel running at http://localhost:' + PORT);
  console.log('Proxying /api/ -> http://127.0.0.1:' + BACKEND_PORT);
});
SERVEREOF

    cat > packages/admin-panel/bankykit-admin/start.sh << 'STARTEOF'
#!/bin/bash
set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem.config.cjs'); console.log(c.port || 5002);" 2>/dev/null || echo "5002")
BACKEND_PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem.config.cjs'); console.log(c.backend_port || 8000);" 2>/dev/null || echo "8000")

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BankyKit Admin Panel - Starting${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  Preview port:   ${PORT}"
echo "  Backend port:   ${BACKEND_PORT}"
echo ""

if ! command -v pm2 &>/dev/null; then
    echo -e "${GREEN}>>> Starting server (no PM2 found)...${NC}"
    node server.cjs
else
    echo -e "${GREEN}>>> Starting with PM2...${NC}"
    pm2 start ecosystem.config.cjs
    pm2 save
    echo ""
    echo -e "${GREEN}  Admin Panel running at: http://localhost:${PORT}${NC}"
    echo "  Stop:    pm2 stop bankykit-admin"
    echo "  Logs:    pm2 logs bankykit-admin"
fi
echo ""
STARTEOF
    chmod +x packages/admin-panel/bankykit-admin/start.sh

    cat > packages/admin-panel/bankykit-admin/install.sh << 'INSTALLEOF'
#!/bin/bash
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
print_step() { echo -e "\n${GREEN}>>> $1${NC}"; }
print_ok()   { echo -e "${GREEN}    [OK] $1${NC}"; }
print_err()  { echo -e "${RED}    [ERROR] $1${NC}"; exit 1; }

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BankyKit Admin Panel - Installer${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

if [ ! -f ecosystem.config.cjs ]; then
    print_err "ecosystem.config.cjs not found. Cannot proceed."
fi

ADMIN_DOMAIN=$(node --input-type=commonjs -e "const c = require('./ecosystem.config.cjs'); console.log(c.domain);" 2>/dev/null || echo "")
if [ -z "$ADMIN_DOMAIN" ] || [ "$ADMIN_DOMAIN" = "undefined" ] || [ "$ADMIN_DOMAIN" = "null" ] || [ "$ADMIN_DOMAIN" = "admin.yourdomain.com" ]; then
    echo ""
    echo -e "${RED}  [ERROR] Domain not set in ecosystem.config.cjs${NC}"
    echo ""
    echo "  Open ecosystem.config.cjs and set your domain:"
    echo "    domain: \"admin.yourdomain.com\","
    echo ""
    exit 1
fi

BACKEND_PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem.config.cjs'); const p = c.backend_port; console.log((p !== undefined && p !== null) ? p : 8000);" 2>/dev/null || echo "8000")
PREVIEW_PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem.config.cjs'); const p = c.port; console.log((p !== undefined && p !== null) ? p : 5002);" 2>/dev/null || echo "5002")

echo -e "  Domain:       ${GREEN}${ADMIN_DOMAIN}${NC}"
echo -e "  Backend port: ${GREEN}${BACKEND_PORT}${NC}"
echo ""

print_step "Step 1/2: Installing dependencies..."
npm install
print_ok "Dependencies installed"

print_step "Step 2/2: Building admin panel..."
npm run build
print_ok "Admin panel built to dist/"

print_step "Starting admin panel..."
if command -v pm2 &>/dev/null; then
    pm2 start ecosystem.config.cjs
    pm2 save
    print_ok "Admin panel running via PM2 on port ${PREVIEW_PORT}"
else
    node server.cjs &
    print_ok "Admin panel running on port ${PREVIEW_PORT}"
fi

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  Admin Panel installed!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  Running on:   http://localhost:${PREVIEW_PORT}"
echo "  Stop:         pm2 stop bankykit-admin"
echo "  Logs:         pm2 logs bankykit-admin"
echo ""
INSTALLEOF
    chmod +x packages/admin-panel/bankykit-admin/install.sh

    cat > packages/admin-panel/bankykit-admin/install-demo.sh << 'INSTALLEOF'
#!/bin/bash
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
print_step() { echo -e "\n${GREEN}>>> $1${NC}"; }
print_ok()   { echo -e "${GREEN}    [OK] $1${NC}"; }
print_err()  { echo -e "${RED}    [ERROR] $1${NC}"; exit 1; }

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BankyKit Admin Panel - Demo Installer${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

if [ ! -f ecosystem-demo.config.cjs ]; then
    print_err "ecosystem-demo.config.cjs not found. Cannot proceed."
fi

ADMIN_DOMAIN=$(node --input-type=commonjs -e "const c = require('./ecosystem-demo.config.cjs'); console.log(c.domain);" 2>/dev/null || echo "")
if [ -z "$ADMIN_DOMAIN" ] || [ "$ADMIN_DOMAIN" = "undefined" ] || [ "$ADMIN_DOMAIN" = "null" ] || [ "$ADMIN_DOMAIN" = "admin.yourdomain.com" ]; then
    echo ""
    echo -e "${RED}  [ERROR] Domain not set in ecosystem-demo.config.cjs${NC}"
    echo ""
    echo "  Open ecosystem-demo.config.cjs and set your domain:"
    echo "    domain: \"admin-demo.yourdomain.com\","
    echo ""
    exit 1
fi

BACKEND_PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem-demo.config.cjs'); const p = c.backend_port; console.log((p !== undefined && p !== null) ? p : 6000);" 2>/dev/null || echo "6000")
PREVIEW_PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem-demo.config.cjs'); const p = c.port; console.log((p !== undefined && p !== null) ? p : 6002);" 2>/dev/null || echo "6002")

echo -e "  Domain:       ${GREEN}${ADMIN_DOMAIN}${NC}"
echo -e "  Backend port: ${GREEN}${BACKEND_PORT}${NC}"
echo -e "  Preview port: ${GREEN}${PREVIEW_PORT}${NC}"
echo ""

print_step "Step 1/2: Installing dependencies..."
npm install
print_ok "Dependencies installed"

print_step "Step 2/2: Building admin panel..."
npm run build
print_ok "Admin panel built to dist/"

print_step "Starting admin panel (demo)..."
if command -v pm2 &>/dev/null; then
    pm2 start ecosystem-demo.config.cjs
    pm2 save
    print_ok "Admin panel (demo) running via PM2 on port ${PREVIEW_PORT}"
else
    node server.cjs &
    print_ok "Admin panel (demo) running on port ${PREVIEW_PORT}"
fi

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  Admin Panel (Demo) installed!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  Running on:   http://localhost:${PREVIEW_PORT}"
echo "  Stop:         pm2 stop bankykit-demo-admin"
echo "  Logs:         pm2 logs bankykit-demo-admin"
echo ""
INSTALLEOF
    chmod +x packages/admin-panel/bankykit-admin/install-demo.sh

    cd packages/admin-panel
    zip -r bankykit-admin-v1.0.0.zip bankykit-admin
    cd ../..
    echo ">>> Admin Panel package: packages/admin-panel/bankykit-admin-v1.0.0.zip"
}

build_landing_page() {
    echo ""
    echo "========================================"
    echo "  Packaging Landing Page (source code)"
    echo "========================================"
    echo "    (No build needed - run install.sh on your server)"

    rm -rf packages/landing-page
    mkdir -p packages/landing-page/bankykit-landing

    cp -r landing-page/src        packages/landing-page/bankykit-landing/
    cp -r landing-page/public     packages/landing-page/bankykit-landing/
    cp    landing-page/index.html  packages/landing-page/bankykit-landing/
    cp    landing-page/package.json packages/landing-page/bankykit-landing/
    cp    landing-page/package-lock.json packages/landing-page/bankykit-landing/ 2>/dev/null || true
    cp    landing-page/vite.config.ts packages/landing-page/bankykit-landing/
    cp    landing-page/tsconfig.json packages/landing-page/bankykit-landing/ 2>/dev/null || true
    cp    landing-page/tsconfig.node.json packages/landing-page/bankykit-landing/ 2>/dev/null || true
    cp    landing-page/tailwind.config.js packages/landing-page/bankykit-landing/ 2>/dev/null || true
    cp    landing-page/postcss.config.js packages/landing-page/bankykit-landing/ 2>/dev/null || true

    find packages/landing-page/bankykit-landing -name ".DS_Store" -delete 2>/dev/null || true

    cat > packages/landing-page/bankykit-landing/ecosystem.config.cjs << 'ECOEOF'
const path = require("path");

const rootDir = __dirname;

module.exports = {
  domain: "bankykit.com",
  port: 5003,
  backend_port: 5000,

  apps: [
    {
      name: "bankykit-landing",
      cwd: rootDir,
      script: "server.cjs",
      env: { NODE_ENV: "production" },
      autorestart: true,
    },
  ],
};
ECOEOF

    cat > packages/landing-page/bankykit-landing/ecosystem-demo.config.cjs << 'ECOEOF'
const path = require("path");

const rootDir = __dirname;

module.exports = {
  domain: "doc.bankykit.com",
  port: 6003,
  backend_port: 6000,

  apps: [
    {
      name: "bankykit-demo-landing",
      cwd: rootDir,
      script: "server.cjs",
      env: { NODE_ENV: "production", PORT: "6003", BACKEND_PORT: "6000" },
      autorestart: true,
    },
  ],
};
ECOEOF

    cat > packages/landing-page/bankykit-landing/server.cjs << 'SERVEREOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./ecosystem.config.cjs');

const PORT = process.env.PORT || config.port || 5003;
const BACKEND_PORT = process.env.BACKEND_PORT || config.backend_port || 8000;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const opts = {
      hostname: '127.0.0.1', port: BACKEND_PORT,
      path: req.url, method: req.method, headers: req.headers,
    };
    const proxy = http.request(opts, (back) => {
      res.writeHead(back.statusCode, back.headers);
      back.pipe(res);
    });
    proxy.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend not reachable on port ' + BACKEND_PORT }));
    });
    req.pipe(proxy);
    return;
  }
  const urlPath = req.url.split('?')[0].split('#')[0];
  let file = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST_DIR, 'index.html');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('BankyKit Landing Page running at http://localhost:' + PORT);
  console.log('Proxying /api/ -> http://127.0.0.1:' + BACKEND_PORT);
});
SERVEREOF

    cat > packages/landing-page/bankykit-landing/start.sh << 'STARTEOF'
#!/bin/bash
set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem.config.cjs'); console.log(c.port || 5003);" 2>/dev/null || echo "5003")
BACKEND_PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem.config.cjs'); console.log(c.backend_port || 8000);" 2>/dev/null || echo "8000")

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BankyKit Landing Page - Starting${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  Preview port:   ${PORT}"
echo "  Backend port:   ${BACKEND_PORT}"
echo ""

if ! command -v pm2 &>/dev/null; then
    echo -e "${GREEN}>>> Starting server (no PM2 found)...${NC}"
    node server.cjs
else
    echo -e "${GREEN}>>> Starting with PM2...${NC}"
    pm2 start ecosystem.config.cjs
    pm2 save
    echo ""
    echo -e "${GREEN}  Landing Page running at: http://localhost:${PORT}${NC}"
    echo "  Stop:    pm2 stop bankykit-landing"
    echo "  Logs:    pm2 logs bankykit-landing"
fi
echo ""
STARTEOF
    chmod +x packages/landing-page/bankykit-landing/start.sh

    cat > packages/landing-page/bankykit-landing/install.sh << 'INSTALLEOF'
#!/bin/bash
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
print_step() { echo -e "\n${GREEN}>>> $1${NC}"; }
print_ok()   { echo -e "${GREEN}    [OK] $1${NC}"; }
print_err()  { echo -e "${RED}    [ERROR] $1${NC}"; exit 1; }

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BankyKit Landing Page - Installer${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

if [ ! -f ecosystem.config.cjs ]; then
    print_err "ecosystem.config.cjs not found. Cannot proceed."
fi

DOMAIN=$(node --input-type=commonjs -e "const c = require('./ecosystem.config.cjs'); console.log(c.domain);" 2>/dev/null || echo "")
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "undefined" ] || [ "$DOMAIN" = "null" ] || [ "$DOMAIN" = "yourdomain.com" ]; then
    echo ""
    echo -e "${RED}  [ERROR] Domain not set in ecosystem.config.cjs${NC}"
    echo ""
    echo "  Open ecosystem.config.cjs and set your domain:"
    echo "    domain: \"yourdomain.com\","
    echo ""
    exit 1
fi

BACKEND_PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem.config.cjs'); const p = c.backend_port; console.log((p !== undefined && p !== null) ? p : 8000);" 2>/dev/null || echo "8000")
PREVIEW_PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem.config.cjs'); const p = c.port; console.log((p !== undefined && p !== null) ? p : 5003);" 2>/dev/null || echo "5003")

echo -e "  Domain:       ${GREEN}${DOMAIN}${NC}"
echo -e "  Backend port: ${GREEN}${BACKEND_PORT}${NC}"
echo ""

print_step "Step 1/2: Installing dependencies..."
npm install
print_ok "Dependencies installed"

print_step "Step 2/2: Building landing page..."
npm run build
print_ok "Landing page built to dist/"

print_step "Starting landing page..."
if command -v pm2 &>/dev/null; then
    pm2 start ecosystem.config.cjs
    pm2 save
    print_ok "Landing page running via PM2 on port ${PREVIEW_PORT}"
else
    node server.cjs &
    print_ok "Landing page running on port ${PREVIEW_PORT}"
fi

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  Landing Page installed!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  Running on:   http://localhost:${PREVIEW_PORT}"
echo "  Stop:         pm2 stop bankykit-landing"
echo "  Logs:         pm2 logs bankykit-landing"
echo ""
INSTALLEOF
    chmod +x packages/landing-page/bankykit-landing/install.sh

    cat > packages/landing-page/bankykit-landing/install-demo.sh << 'INSTALLEOF'
#!/bin/bash
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
print_step() { echo -e "\n${GREEN}>>> $1${NC}"; }
print_ok()   { echo -e "${GREEN}    [OK] $1${NC}"; }
print_err()  { echo -e "${RED}    [ERROR] $1${NC}"; exit 1; }

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BankyKit Landing Page - Demo Installer${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

if [ ! -f ecosystem-demo.config.cjs ]; then
    print_err "ecosystem-demo.config.cjs not found. Cannot proceed."
fi

DOMAIN=$(node --input-type=commonjs -e "const c = require('./ecosystem-demo.config.cjs'); console.log(c.domain);" 2>/dev/null || echo "")
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "undefined" ] || [ "$DOMAIN" = "null" ] || [ "$DOMAIN" = "yourdomain.com" ]; then
    echo ""
    echo -e "${RED}  [ERROR] Domain not set in ecosystem-demo.config.cjs${NC}"
    echo ""
    echo "  Open ecosystem-demo.config.cjs and set your domain:"
    echo "    domain: \"demo.yourdomain.com\","
    echo ""
    exit 1
fi

BACKEND_PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem-demo.config.cjs'); const p = c.backend_port; console.log((p !== undefined && p !== null) ? p : 6000);" 2>/dev/null || echo "6000")
PREVIEW_PORT=$(node --input-type=commonjs -e "const c = require('./ecosystem-demo.config.cjs'); const p = c.port; console.log((p !== undefined && p !== null) ? p : 6003);" 2>/dev/null || echo "6003")

echo -e "  Domain:       ${GREEN}${DOMAIN}${NC}"
echo -e "  Backend port: ${GREEN}${BACKEND_PORT}${NC}"
echo -e "  Preview port: ${GREEN}${PREVIEW_PORT}${NC}"
echo ""

print_step "Step 1/2: Installing dependencies..."
npm install
print_ok "Dependencies installed"

print_step "Step 2/2: Building landing page..."
npm run build
print_ok "Landing page built to dist/"

print_step "Starting landing page (demo)..."
if command -v pm2 &>/dev/null; then
    pm2 start ecosystem-demo.config.cjs
    pm2 save
    print_ok "Landing page (demo) running via PM2 on port ${PREVIEW_PORT}"
else
    node server.cjs &
    print_ok "Landing page (demo) running on port ${PREVIEW_PORT}"
fi

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  Landing Page (Demo) installed!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  Running on:   http://localhost:${PREVIEW_PORT}"
echo "  Stop:         pm2 stop bankykit-demo-landing"
echo "  Logs:         pm2 logs bankykit-demo-landing"
echo ""
INSTALLEOF
    chmod +x packages/landing-page/bankykit-landing/install-demo.sh

    cd packages/landing-page
    zip -r bankykit-landing-v1.0.0.zip bankykit-landing
    cd ../..
    echo ">>> Landing Page package: packages/landing-page/bankykit-landing-v1.0.0.zip"
}

cleanup() {
    echo ""
    echo ">>> Cleaning up temporary files..."
    rm -rf python_backend/build python_backend/dist python_backend/*.spec 2>/dev/null || true
    rm -f python_backend/bankykit_server.py 2>/dev/null || true
}

show_menu

case $choice in
    1)
        build_codecanyon
        ;;
    2)
        build_admin_panel
        ;;
    3)
        build_landing_page
        ;;
    4)
        build_codecanyon
        build_admin_panel
        build_landing_page
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
[ -d "packages/codecanyon" ]    && echo "  - CodeCanyon:   packages/codecanyon/"
[ -f "packages/codecanyon/bankykit-v1.0.0.zip" ]         && echo "                  packages/codecanyon/bankykit-v1.0.0.zip"
[ -f "packages/admin-panel/bankykit-admin-v1.0.0.zip" ]  && echo "  - Admin Panel:  packages/admin-panel/bankykit-admin-v1.0.0.zip"
[ -f "packages/landing-page/bankykit-landing-v1.0.0.zip" ] && echo "  - Landing Page: packages/landing-page/bankykit-landing-v1.0.0.zip"
echo ""

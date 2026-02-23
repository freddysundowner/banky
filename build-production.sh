#!/bin/bash

set -e

echo "========================================"
echo "  BankyKit Production Build Script"
echo "========================================"
echo ""

show_menu() {
    echo "Select build type:"
    echo "  1) SaaS Build         (for your cloud deployment)"
    echo "  2) Enterprise Build   (end-user self-hosting)"
    echo "  3) CodeCanyon Package (source code + installer for buyers)"
    echo "  4) Admin Panel        (source code + installer, like CodeCanyon)"
    echo "  5) Landing Page       (source code + installer, like CodeCanyon)"
    echo "  6) Build All"
    echo "  7) Exit"
    echo ""
    read -p "Enter choice [1-7]: " choice
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
    npm install --silent 2>/dev/null || npm install
    npm run build
    cd ..
    echo ">>> Admin panel built to admin-client/dist/"
}

build_landing() {
    echo ""
    echo ">>> Building Landing Page..."
    cd landing-page
    npm install --silent 2>/dev/null || npm install
    npm run build
    cd ..
    echo ">>> Landing page built to landing-page/dist/"
}

build_saas() {
    echo ""
    echo "========================================"
    echo "  Building SaaS Version"
    echo "========================================"
    
    build_frontend
    build_admin
    build_landing
    
    echo ""
    echo ">>> Creating SaaS deployment package..."
    
    rm -rf packages/saas
    mkdir -p packages/saas
    
    cp -r dist/public packages/saas/frontend
    cp -r admin-client/dist packages/saas/admin
    cp -r landing-page/dist packages/saas/landing
    cp -r python_backend packages/saas/backend
    cp -r shared packages/saas/shared 2>/dev/null || true
    
    rm -rf packages/saas/backend/__pycache__
    find packages/saas/backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find packages/saas/backend -type f -name "*.pyc" -delete 2>/dev/null || true
    rm -rf packages/saas/backend/uploads 2>/dev/null || true
    rm -rf packages/saas/backend/tests 2>/dev/null || true
    
    cat > packages/saas/.env.example << 'EOF'
# Database connection
DATABASE_URL=postgresql://user:password@host:5432/bankykit_master

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
      name: "bankykit-api",
      cwd: path.join(rootDir, "backend"),
      script: "uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 2",
      interpreter: "python3",
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "500M",
      autorestart: true,
    },
    {
      name: "bankykit-scheduler",
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
    mkdir -p packages/enterprise/bankykit
    
    # Copy only end-user source code (no admin-client, no landing-page)
    cp -r client packages/enterprise/bankykit/
    cp -r python_backend packages/enterprise/bankykit/
    cp -r server packages/enterprise/bankykit/
    cp -r shared packages/enterprise/bankykit/ 2>/dev/null || true
    cp package.json packages/enterprise/bankykit/
    cp package-lock.json packages/enterprise/bankykit/ 2>/dev/null || true
    cp vite.config.ts packages/enterprise/bankykit/
    cp tsconfig.json packages/enterprise/bankykit/
    cp tailwind.config.ts packages/enterprise/bankykit/ 2>/dev/null || true
    cp postcss.config.js packages/enterprise/bankykit/ 2>/dev/null || true
    
    # Clean up unnecessary files
    find packages/enterprise/bankykit -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
    find packages/enterprise/bankykit -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find packages/enterprise/bankykit -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true
    find packages/enterprise/bankykit -type f -name "*.pyc" -delete 2>/dev/null || true
    find packages/enterprise/bankykit -type f -name ".env" -delete 2>/dev/null || true
    find packages/enterprise/bankykit -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
    find packages/enterprise/bankykit -name ".DS_Store" -delete 2>/dev/null || true
    rm -rf packages/enterprise/bankykit/python_backend/tests 2>/dev/null || true
    rm -rf packages/enterprise/bankykit/python_backend/uploads 2>/dev/null || true
    rm -f packages/enterprise/bankykit/drizzle.config.ts 2>/dev/null || true
    rm -f packages/enterprise/bankykit/components.json 2>/dev/null || true
    
    cat > packages/enterprise/bankykit/.env.example << 'EOF'
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
VITE_PRODUCTION_MODE=demo

# Random secret for session encryption (minimum 32 characters)
# Generate with: openssl rand -hex 32
SESSION_SECRET=change-this-to-a-random-string-at-least-32-characters

# Your domain (set by install.sh)
DOMAIN=localhost

# Application port (default: 5000)
PORT=5000
EOF

    # Use the repo install.sh so updates are always reflected in the package
    cp install.sh packages/enterprise/bankykit/install.sh
    chmod +x packages/enterprise/bankykit/install.sh

    # Create start script (development mode)
    cp start.sh packages/enterprise/bankykit/start.sh
    chmod +x packages/enterprise/bankykit/start.sh

    # Create ecosystem.config.js for production (PM2)
    cat > packages/enterprise/bankykit/ecosystem.config.js << 'PMEOF'
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
      script: "uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 2",
      interpreter: "python3",
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "500M",
      autorestart: true,
    },
    {
      name: "bankykit-scheduler",
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
VITE_PRODUCTION_MODE=demo

# Random secret for session encryption (minimum 32 characters)
# Generate with: openssl rand -hex 32
SESSION_SECRET=CHANGE_ME

# Your domain (set by install.sh)
DOMAIN=localhost

# Application port (default: 5000)
PORT=5000
EOF

    # Use the repo install.sh so updates are always reflected in the package
    cp install.sh packages/codecanyon/bankykit/install.sh
    chmod +x packages/codecanyon/bankykit/install.sh

    # ── start.sh: copied from root so it's always up to date ──
    cp start.sh packages/codecanyon/bankykit/start.sh
    chmod +x packages/codecanyon/bankykit/start.sh

    # ── ecosystem.config.js for PM2 production setup ──
    cat > packages/codecanyon/bankykit/ecosystem.config.js << 'PMEOF'
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
      script: "uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 2",
      interpreter: path.join(rootDir, "venv", "bin", "python3"),
      env: { ...envVars, NODE_ENV: "production" },
      max_memory_restart: "500M",
      autorestart: true,
    },
    {
      name: "bankykit-scheduler",
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
    zip -r bankykit-v1.0.0.zip bankykit
    cd ../..
    
    echo ">>> ZIP package: packages/codecanyon/bankykit-v1.0.0.zip"
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
        build_saas
        ;;
    2)
        build_compiled
        ;;
    3)
        build_codecanyon
        ;;
    4)
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

        cat > packages/admin-panel/bankykit-admin/install.sh << 'INSTALLEOF'
#!/bin/bash
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
print_step() { echo -e "\n${GREEN}>>> $1${NC}"; }
print_ok()   { echo -e "${GREEN}    [OK] $1${NC}"; }
print_err()  { echo -e "${RED}    [ERROR] $1${NC}"; }

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BankyKit Admin Panel - Installer${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

read -p "  Enter your admin subdomain (e.g. admin.yourdomain.com): " ADMIN_DOMAIN
ADMIN_DOMAIN=${ADMIN_DOMAIN:-admin.localhost}

print_step "Step 1/3: Installing dependencies..."
npm install
print_ok "Dependencies installed"

print_step "Step 2/3: Building admin panel..."
npm run build
print_ok "Admin panel built to dist/"

print_step "Step 3/3: Configuring Nginx..."
NGINX_CONF="/etc/nginx/sites-available/bankykit-admin"
APP_DIR=$(pwd)

sudo tee "$NGINX_CONF" > /dev/null << NGINXEOF
server {
    listen 80;
    server_name ${ADMIN_DOMAIN};
    root ${APP_DIR}/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
NGINXEOF

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/bankykit-admin
sudo nginx -t && sudo nginx -s reload
print_ok "Nginx configured for ${ADMIN_DOMAIN}"

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  Admin Panel installed!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  Access at: http://${ADMIN_DOMAIN}"
echo "  Add SSL:   sudo certbot --nginx -d ${ADMIN_DOMAIN}"
echo ""
INSTALLEOF
        chmod +x packages/admin-panel/bankykit-admin/install.sh

        cd packages/admin-panel
        zip -r bankykit-admin-v1.0.0.zip bankykit-admin
        cd ../..
        echo ">>> Admin Panel package: packages/admin-panel/bankykit-admin-v1.0.0.zip"
        ;;
    5)
        echo ""
        echo "========================================"
        echo "  Packaging Landing Page (source code)"
        echo "========================================"
        echo "    (No build needed - run install.sh on your server)"

        rm -rf packages/landing-page
        mkdir -p packages/landing-page/bankykit-landing

        cp -r landing-page/src        packages/landing-page/bankykit-landing/
        cp    landing-page/index.html  packages/landing-page/bankykit-landing/
        cp    landing-page/package.json packages/landing-page/bankykit-landing/
        cp    landing-page/package-lock.json packages/landing-page/bankykit-landing/ 2>/dev/null || true
        cp    landing-page/vite.config.ts packages/landing-page/bankykit-landing/
        cp    landing-page/tsconfig.json packages/landing-page/bankykit-landing/ 2>/dev/null || true
        cp    landing-page/tsconfig.node.json packages/landing-page/bankykit-landing/ 2>/dev/null || true
        cp    landing-page/tailwind.config.js packages/landing-page/bankykit-landing/ 2>/dev/null || true
        cp    landing-page/postcss.config.js packages/landing-page/bankykit-landing/ 2>/dev/null || true

        find packages/landing-page/bankykit-landing -name ".DS_Store" -delete 2>/dev/null || true

        cat > packages/landing-page/bankykit-landing/install.sh << 'INSTALLEOF'
#!/bin/bash
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
print_step() { echo -e "\n${GREEN}>>> $1${NC}"; }
print_ok()   { echo -e "${GREEN}    [OK] $1${NC}"; }
print_err()  { echo -e "${RED}    [ERROR] $1${NC}"; }

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BankyKit Landing Page - Installer${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

read -p "  Enter your domain (e.g. yourdomain.com): " DOMAIN
DOMAIN=${DOMAIN:-localhost}

print_step "Step 1/3: Installing dependencies..."
npm install
print_ok "Dependencies installed"

print_step "Step 2/3: Building landing page..."
npm run build
print_ok "Landing page built to dist/"

print_step "Step 3/3: Configuring Nginx..."
NGINX_CONF="/etc/nginx/sites-available/bankykit-landing"
APP_DIR=$(pwd)

sudo tee "$NGINX_CONF" > /dev/null << NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${APP_DIR}/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
NGINXEOF

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/bankykit-landing
sudo nginx -t && sudo nginx -s reload
print_ok "Nginx configured for ${DOMAIN}"

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  Landing Page installed!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  Access at: http://${DOMAIN}"
echo "  Add SSL:   sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo ""
INSTALLEOF
        chmod +x packages/landing-page/bankykit-landing/install.sh

        cd packages/landing-page
        zip -r bankykit-landing-v1.0.0.zip bankykit-landing
        cd ../..
        echo ">>> Landing Page package: packages/landing-page/bankykit-landing-v1.0.0.zip"
        ;;
    6)
        build_saas
        build_compiled
        build_codecanyon
        ;;
    7)
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
[ -d "packages/saas" ]          && echo "  - SaaS:         packages/saas/"
[ -d "packages/enterprise" ]    && echo "  - Enterprise:   packages/enterprise/"
[ -d "packages/codecanyon" ]    && echo "  - CodeCanyon:   packages/codecanyon/"
[ -f "packages/codecanyon/bankykit-v1.0.0.zip" ]         && echo "                  packages/codecanyon/bankykit-v1.0.0.zip"
[ -f "packages/admin-panel/bankykit-admin-v1.0.0.zip" ]  && echo "  - Admin Panel:  packages/admin-panel/bankykit-admin-v1.0.0.zip"
[ -f "packages/landing-page/bankykit-landing-v1.0.0.zip" ] && echo "  - Landing Page: packages/landing-page/bankykit-landing-v1.0.0.zip"
echo ""

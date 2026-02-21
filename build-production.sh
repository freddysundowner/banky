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
    echo "  3) CodeCanyon Build (end-user with lifetime key)"
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

    # Create install script
    cat > packages/enterprise/banky/install.sh << 'INSTALLSCRIPT'
#!/bin/bash

echo "========================================"
echo "  BANKY Installation"
echo "========================================"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js 18+ is required. Install from https://nodejs.org"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3.11+ is required. Install from https://python.org"; exit 1; }
command -v pip >/dev/null 2>&1 || command -v pip3 >/dev/null 2>&1 || { echo "pip is required. Install with: python3 -m ensurepip"; exit 1; }

PIP_CMD=$(command -v pip3 2>/dev/null || command -v pip 2>/dev/null)

echo "Step 1/3: Installing frontend dependencies..."
npm install

echo ""
echo "Step 2/3: Installing Python backend dependencies..."
cd python_backend && $PIP_CMD install -r requirements.txt && cd ..

echo ""
echo "Step 3/3: Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file from .env.example"
    echo "All features are unlocked by default."
else
    echo ".env already exists"
fi

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your database URL and session secret"
echo "  2. For development: ./start.sh"
echo "  3. For production:  See README.md for PM2/Nginx setup"
echo ""
INSTALLSCRIPT
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
    echo "  Building CodeCanyon Version"
    echo "========================================"
    
    build_frontend
    
    echo ""
    echo ">>> Creating CodeCanyon source package..."
    
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

    # ── Complete install.sh that does EVERYTHING ──
    cat > packages/codecanyon/banky/install.sh << 'INSTALLSCRIPT'
#!/bin/bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "\n${GREEN}>>> $1${NC}"; }
print_ok()   { echo -e "${GREEN}    ✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}    ⚠ $1${NC}"; }
print_err()  { echo -e "${RED}    ✗ $1${NC}"; }

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  BANKY - Bank & Sacco Management System${NC}"
echo -e "${BLUE}  Full Server Installation${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root (use: sudo ./install.sh)"
    exit 1
fi

# ── Ask for domain ──
read -p "Enter your domain (e.g. banky.example.com): " USER_DOMAIN
if [ -z "$USER_DOMAIN" ]; then
    print_err "Domain is required"
    exit 1
fi

# ── Generate secrets ──
DB_PASSWORD=$(openssl rand -hex 16)
SESSION_SECRET=$(openssl rand -hex 32)
APP_DIR=$(pwd)

# ══════════════════════════════════════════════════════════════
#  STEP 1: Install system packages
# ══════════════════════════════════════════════════════════════
print_step "Step 1/8: Installing system packages..."

apt update && apt upgrade -y
apt install -y curl wget git build-essential software-properties-common

# Node.js 20
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    print_ok "Node.js $(node -v) installed"
else
    print_ok "Node.js $(node -v) already installed"
fi

# Python 3.11+
if ! command -v python3 >/dev/null 2>&1; then
    apt install -y python3 python3-venv python3-pip python3-dev
    print_ok "Python installed"
else
    print_ok "Python $(python3 --version) already installed"
fi
apt install -y python3-venv python3-pip python3-dev 2>/dev/null || true

# PostgreSQL
if ! command -v psql >/dev/null 2>&1; then
    apt install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
    print_ok "PostgreSQL installed and started"
else
    print_ok "PostgreSQL already installed"
fi

# Nginx
if ! command -v nginx >/dev/null 2>&1; then
    apt install -y nginx
    systemctl enable nginx
    print_ok "Nginx installed"
else
    print_ok "Nginx already installed"
fi

# PM2
if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
    print_ok "PM2 installed"
else
    print_ok "PM2 already installed"
fi

# Certbot for SSL
apt install -y certbot python3-certbot-nginx 2>/dev/null || true
print_ok "Certbot installed"

# ══════════════════════════════════════════════════════════════
#  STEP 2: Create PostgreSQL database
# ══════════════════════════════════════════════════════════════
print_step "Step 2/8: Setting up PostgreSQL database..."

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='banky'" | grep -q 1 || {
    sudo -u postgres psql -c "CREATE USER banky WITH PASSWORD '${DB_PASSWORD}';"
    print_ok "Database user 'banky' created"
}

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='banky'" | grep -q 1 || {
    sudo -u postgres psql -c "CREATE DATABASE banky OWNER banky;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE banky TO banky;"
    print_ok "Database 'banky' created"
}

# ══════════════════════════════════════════════════════════════
#  STEP 3: Configure environment
# ══════════════════════════════════════════════════════════════
print_step "Step 3/8: Configuring environment..."

cat > .env << ENVEOF
DATABASE_URL=postgresql://banky:${DB_PASSWORD}@localhost:5432/banky
DEPLOYMENT_MODE=enterprise
SESSION_SECRET=${SESSION_SECRET}
DOMAIN=${USER_DOMAIN}
PORT=5000
ENVEOF

print_ok ".env file created with secure credentials"

# ══════════════════════════════════════════════════════════════
#  STEP 4: Install Node.js dependencies
# ══════════════════════════════════════════════════════════════
print_step "Step 4/8: Installing frontend dependencies..."

npm install
print_ok "Node.js dependencies installed"

# ══════════════════════════════════════════════════════════════
#  STEP 5: Install Python dependencies
# ══════════════════════════════════════════════════════════════
print_step "Step 5/8: Installing Python backend dependencies..."

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r python_backend/requirements.txt -q
deactivate
print_ok "Python dependencies installed in virtual environment"

# ══════════════════════════════════════════════════════════════
#  STEP 6: Build frontend
# ══════════════════════════════════════════════════════════════
print_step "Step 6/8: Building frontend for production..."

npx vite build
print_ok "Frontend built to dist/public/"

# ══════════════════════════════════════════════════════════════
#  STEP 7: Configure Nginx
# ══════════════════════════════════════════════════════════════
print_step "Step 7/8: Configuring Nginx..."

cat > /etc/nginx/sites-available/banky << NGINXEOF
server {
    listen 80;
    server_name ${USER_DOMAIN};

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/banky
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t && systemctl reload nginx
print_ok "Nginx configured for ${USER_DOMAIN}"

# ══════════════════════════════════════════════════════════════
#  STEP 8: Create PM2 ecosystem and start
# ══════════════════════════════════════════════════════════════
print_step "Step 8/8: Starting BANKY with PM2..."

cat > ecosystem.config.cjs << PMEOF
const path = require("path");
const fs = require("fs");

const rootDir = "${APP_DIR}";
const envPath = path.join(rootDir, ".env");
const envVars = {};

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\\n");
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
      script: "${APP_DIR}/venv/bin/uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 2",
      interpreter: "${APP_DIR}/venv/bin/python3",
      env: { ...envVars, NODE_ENV: "production", VIRTUAL_ENV: "${APP_DIR}/venv", PATH: "${APP_DIR}/venv/bin:" + process.env.PATH },
      max_memory_restart: "500M",
      autorestart: true,
    },
    {
      name: "banky-scheduler",
      cwd: path.join(rootDir, "python_backend"),
      script: "scheduler.py",
      interpreter: "${APP_DIR}/venv/bin/python3",
      env: { ...envVars, NODE_ENV: "production", VIRTUAL_ENV: "${APP_DIR}/venv", PATH: "${APP_DIR}/venv/bin:" + process.env.PATH },
      max_memory_restart: "200M",
      autorestart: true,
      cron_restart: "0 */6 * * *",
    }
  ],
};
PMEOF

pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup 2>/dev/null || true
print_ok "BANKY services started with PM2"

# ══════════════════════════════════════════════════════════════
#  STEP 9: SSL Certificate (optional)
# ══════════════════════════════════════════════════════════════
echo ""
read -p "Set up free SSL certificate with Let's Encrypt? (y/n): " SETUP_SSL
if [ "$SETUP_SSL" = "y" ] || [ "$SETUP_SSL" = "Y" ]; then
    print_step "Setting up SSL certificate..."
    certbot --nginx -d "${USER_DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null || {
        echo ""
        read -p "Enter your email for SSL certificate: " SSL_EMAIL
        certbot --nginx -d "${USER_DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" || {
            print_warn "SSL setup failed. You can run it manually later:"
            echo "    sudo certbot --nginx -d ${USER_DOMAIN}"
        }
    }
fi

# ══════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Your BANKY instance is now running at:"
echo ""
echo "    http://${USER_DOMAIN}"
echo ""
echo "  Open it in your browser to create your first account."
echo ""
echo "  Useful commands:"
echo "    pm2 status          - Check if services are running"
echo "    pm2 logs            - View application logs"
echo "    pm2 restart all     - Restart all services"
echo "    sudo certbot renew  - Renew SSL certificate"
echo ""
echo "  Database credentials (saved in .env):"
echo "    User: banky"
echo "    Database: banky"
echo "    Host: localhost"
echo ""
echo "  All features are unlocked. No license key needed."
echo ""
INSTALLSCRIPT
    chmod +x packages/codecanyon/banky/install.sh

    # Create ecosystem.config.js fallback for manual PM2 setup
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

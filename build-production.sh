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
print_ok()   { echo -e "${GREEN}    [OK] $1${NC}"; }
print_skip() { echo -e "${YELLOW}    [SKIP] $1${NC}"; }
print_warn() { echo -e "${YELLOW}    [WARN] $1${NC}"; }
print_err()  { echo -e "${RED}    [ERROR] $1${NC}"; }
print_new()  { echo -e "${GREEN}    [NEW] $1${NC}"; }

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BANKY - Bank & Sacco Management System${NC}"
echo -e "${BLUE}  Full Server Installation${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# ── Must run as root ──
if [ "$(id -u)" -ne 0 ]; then
    print_err "This script must be run as root (use: sudo ./install.sh)"
    exit 1
fi

# ── Detect OS ──
OS_NAME="unknown"
OS_VERSION=""
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME="${ID:-unknown}"
    OS_VERSION="${VERSION_ID:-}"
    echo "  Detected OS: ${PRETTY_NAME:-$OS_NAME}"
else
    print_warn "Could not detect OS. This script is designed for Ubuntu/Debian."
fi

if [ "$OS_NAME" != "ubuntu" ] && [ "$OS_NAME" != "debian" ]; then
    echo ""
    print_warn "This installer is designed for Ubuntu/Debian."
    read -p "  Continue anyway? (y/n): " CONTINUE_ANYWAY
    if [ "$CONTINUE_ANYWAY" != "y" ] && [ "$CONTINUE_ANYWAY" != "Y" ]; then
        echo "  Exiting."
        exit 0
    fi
fi

# ── Ask for domain ──
echo ""
read -p "  Enter your domain (e.g. banky.example.com): " USER_DOMAIN
if [ -z "$USER_DOMAIN" ]; then
    print_err "Domain is required"
    exit 1
fi

# ── Re-install detection ──
IS_REINSTALL=false
if [ -f .env ]; then
    IS_REINSTALL=true
    echo ""
    print_warn "Existing installation detected!"
    print_warn "Your .env, database, and other configs will NOT be overwritten."
    read -p "  Continue with upgrade/re-install? (y/n): " CONTINUE_REINSTALL
    if [ "$CONTINUE_REINSTALL" != "y" ] && [ "$CONTINUE_REINSTALL" != "Y" ]; then
        echo "  Exiting."
        exit 0
    fi
fi

# ── Generate secrets (only used for fresh installs) ──
DB_PASSWORD=$(openssl rand -hex 16)
SESSION_SECRET=$(openssl rand -hex 32)
APP_DIR=$(pwd)

echo ""
echo "  Installation directory: ${APP_DIR}"
echo "  Domain: ${USER_DOMAIN}"
echo ""

# ══════════════════════════════════════════════════════════════
#  STEP 1: Check & install system packages
# ══════════════════════════════════════════════════════════════
print_step "Step 1/9: Checking system packages..."

echo ""
echo "  Scanning for existing installations..."
echo ""

# Summary of what's found
INSTALL_NEEDED=""

check_installed() {
    local name="$1"
    local cmd="$2"
    if command -v "$cmd" >/dev/null 2>&1; then
        local ver
        case "$cmd" in
            node)   ver=$(node -v 2>/dev/null) ;;
            python3) ver=$(python3 --version 2>/dev/null) ;;
            psql)   ver=$(psql --version 2>/dev/null | head -1) ;;
            nginx)  ver=$(nginx -v 2>&1 | cut -d/ -f2) ;;
            pm2)    ver=$(pm2 -v 2>/dev/null) ;;
            certbot) ver=$(certbot --version 2>/dev/null | head -1) ;;
            *)      ver="installed" ;;
        esac
        print_ok "${name}: ${ver} (found)"
        return 0
    else
        print_warn "${name}: not found (will install)"
        INSTALL_NEEDED="${INSTALL_NEEDED} ${name}"
        return 1
    fi
}

check_installed "Node.js" "node" && HAS_NODE=0 || HAS_NODE=1
check_installed "Python" "python3" && HAS_PYTHON=0 || HAS_PYTHON=1
check_installed "PostgreSQL" "psql" && HAS_POSTGRES=0 || HAS_POSTGRES=1
check_installed "Nginx" "nginx" && HAS_NGINX=0 || HAS_NGINX=1
check_installed "PM2" "pm2" && HAS_PM2=0 || HAS_PM2=1
check_installed "Certbot" "certbot" && HAS_CERTBOT=0 || HAS_CERTBOT=1

echo ""
if [ -z "$INSTALL_NEEDED" ]; then
    print_ok "All required packages are already installed!"
else
    echo "  Will install:${INSTALL_NEEDED}"
    read -p "  Proceed with installation? (y/n): " PROCEED_INSTALL
    if [ "$PROCEED_INSTALL" != "y" ] && [ "$PROCEED_INSTALL" != "Y" ]; then
        echo "  Exiting."
        exit 0
    fi
fi

# Only run apt update if we need to install something
if [ -n "$INSTALL_NEEDED" ]; then
    apt update -y
fi

# Install basic build tools if missing
for pkg in curl wget git build-essential software-properties-common; do
    dpkg -s "$pkg" >/dev/null 2>&1 || apt install -y "$pkg" 2>/dev/null || true
done

# Node.js 20
if [ $HAS_NODE -ne 0 ]; then
    print_step "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    print_new "Node.js $(node -v) installed"
fi

# Python 3
if [ $HAS_PYTHON -ne 0 ]; then
    print_step "Installing Python 3..."
    apt install -y python3 python3-venv python3-pip python3-dev
    print_new "Python $(python3 --version) installed"
else
    # Ensure sub-packages are present without upgrading Python itself
    for pkg in python3-venv python3-pip python3-dev; do
        if ! dpkg -s "$pkg" >/dev/null 2>&1; then
            apt install -y "$pkg" 2>/dev/null || true
            print_new "Installed missing package: $pkg"
        fi
    done
fi

# PostgreSQL
if [ $HAS_POSTGRES -ne 0 ]; then
    print_step "Installing PostgreSQL..."
    apt install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
    print_new "PostgreSQL installed and started"
else
    # Just make sure it's running
    if ! systemctl is-active --quiet postgresql; then
        systemctl start postgresql
        print_ok "PostgreSQL was stopped, started it"
    fi
fi

# Nginx
if [ $HAS_NGINX -ne 0 ]; then
    print_step "Installing Nginx..."
    apt install -y nginx
    systemctl enable nginx
    systemctl start nginx
    print_new "Nginx installed"
else
    if ! systemctl is-active --quiet nginx; then
        systemctl start nginx
        print_ok "Nginx was stopped, started it"
    fi
fi

# PM2
if [ $HAS_PM2 -ne 0 ]; then
    print_step "Installing PM2..."
    npm install -g pm2
    print_new "PM2 installed"
fi

# Certbot
if [ $HAS_CERTBOT -ne 0 ]; then
    print_step "Installing Certbot..."
    apt install -y certbot python3-certbot-nginx 2>/dev/null || {
        print_warn "Certbot install failed (non-critical, you can install it later)"
    }
    if command -v certbot >/dev/null 2>&1; then
        print_new "Certbot installed"
    fi
fi

# ══════════════════════════════════════════════════════════════
#  STEP 2: PostgreSQL database setup
# ══════════════════════════════════════════════════════════════
print_step "Step 2/9: Setting up PostgreSQL database..."

DB_USER_EXISTS=false
DB_EXISTS=false

if sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='banky'" 2>/dev/null | grep -q 1; then
    DB_USER_EXISTS=true
    print_skip "Database user 'banky' already exists (password unchanged)"
fi

if sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='banky'" 2>/dev/null | grep -q 1; then
    DB_EXISTS=true
    print_skip "Database 'banky' already exists (your data is safe)"
fi

if [ "$DB_USER_EXISTS" = false ]; then
    sudo -u postgres psql -c "CREATE USER banky WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null
    print_new "Database user 'banky' created with secure password"
fi

if [ "$DB_EXISTS" = false ]; then
    sudo -u postgres psql -c "CREATE DATABASE banky OWNER banky;" 2>/dev/null
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE banky TO banky;" 2>/dev/null
    print_new "Database 'banky' created"
fi

# ══════════════════════════════════════════════════════════════
#  STEP 3: Configure environment
# ══════════════════════════════════════════════════════════════
print_step "Step 3/9: Configuring environment..."

if [ -f .env ]; then
    print_skip ".env already exists (your settings are preserved)"
    print_warn "To reconfigure, edit .env manually: nano ${APP_DIR}/.env"
    
    # Update DOMAIN in existing .env if it changed
    CURRENT_DOMAIN=$(grep "^DOMAIN=" .env 2>/dev/null | cut -d= -f2-)
    if [ -n "$CURRENT_DOMAIN" ] && [ "$CURRENT_DOMAIN" != "$USER_DOMAIN" ]; then
        sed -i "s|^DOMAIN=.*|DOMAIN=${USER_DOMAIN}|" .env
        print_ok "Updated DOMAIN to ${USER_DOMAIN} in existing .env"
    fi
else
    cat > .env << ENVEOF
DATABASE_URL=postgresql://banky:${DB_PASSWORD}@localhost:5432/banky
DEPLOYMENT_MODE=enterprise
SESSION_SECRET=${SESSION_SECRET}
DOMAIN=${USER_DOMAIN}
PORT=5000
ENVEOF
    chmod 600 .env
    print_new ".env file created with secure credentials"
    print_ok "File permissions set to owner-only (600)"
fi

# ══════════════════════════════════════════════════════════════
#  STEP 4: Create uploads directory
# ══════════════════════════════════════════════════════════════
print_step "Step 4/9: Setting up directories..."

mkdir -p python_backend/uploads
print_ok "Upload directory ready"

# ══════════════════════════════════════════════════════════════
#  STEP 5: Install Node.js dependencies
# ══════════════════════════════════════════════════════════════
print_step "Step 5/9: Installing frontend dependencies..."

npm install 2>&1 | tail -3
print_ok "Node.js dependencies installed"

# ══════════════════════════════════════════════════════════════
#  STEP 6: Install Python dependencies
# ══════════════════════════════════════════════════════════════
print_step "Step 6/9: Installing Python backend dependencies..."

if [ -d "venv" ]; then
    print_skip "Python virtual environment already exists"
else
    python3 -m venv venv
    print_new "Python virtual environment created"
fi

source venv/bin/activate
pip install --upgrade pip -q 2>/dev/null
pip install -r python_backend/requirements.txt -q 2>&1 | tail -1
deactivate
print_ok "Python dependencies installed in virtual environment"

# ══════════════════════════════════════════════════════════════
#  STEP 7: Build frontend
# ══════════════════════════════════════════════════════════════
print_step "Step 7/9: Building frontend for production..."

npx vite build 2>&1 | tail -3
print_ok "Frontend built successfully"

# ══════════════════════════════════════════════════════════════
#  STEP 8: Configure Nginx
# ══════════════════════════════════════════════════════════════
print_step "Step 8/9: Configuring Nginx..."

# Backup existing banky config if it exists
if [ -f /etc/nginx/sites-available/banky ]; then
    cp /etc/nginx/sites-available/banky /etc/nginx/sites-available/banky.backup.$(date +%Y%m%d%H%M%S)
    print_skip "Backed up existing Nginx config"
fi

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

# Check other sites - only remove default if BANKY is the only site
SITE_COUNT=$(ls /etc/nginx/sites-enabled/ 2>/dev/null | grep -cv '^banky$' 2>/dev/null || echo "0")
if [ "$SITE_COUNT" -le 1 ] && [ -f /etc/nginx/sites-enabled/default ]; then
    # Only the default site exists besides banky
    EXISTING_DEFAULT=$(ls /etc/nginx/sites-enabled/ 2>/dev/null | grep -c 'default')
    if [ "$EXISTING_DEFAULT" -gt 0 ]; then
        rm -f /etc/nginx/sites-enabled/default
        print_ok "Removed default Nginx placeholder site"
    fi
else
    print_skip "Other Nginx sites detected - default site preserved"
fi

# Test nginx config before reloading
NGINX_TEST=$(nginx -t 2>&1) && NGINX_OK=true || NGINX_OK=false
if [ "$NGINX_OK" = true ]; then
    systemctl reload nginx
    print_ok "Nginx configured and reloaded for ${USER_DOMAIN}"
else
    echo "$NGINX_TEST"
    print_err "Nginx config test failed! See errors above."
    print_warn "Restoring backup if available..."
    LATEST_BACKUP=$(ls -t /etc/nginx/sites-available/banky.backup.* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        cp "$LATEST_BACKUP" /etc/nginx/sites-available/banky
        RESTORE_TEST=$(nginx -t 2>&1) && RESTORE_OK=true || RESTORE_OK=false
        if [ "$RESTORE_OK" = true ]; then
            systemctl reload nginx
            print_ok "Previous Nginx config restored"
        fi
    fi
fi

# ══════════════════════════════════════════════════════════════
#  STEP 9: Start with PM2
# ══════════════════════════════════════════════════════════════
print_step "Step 9/9: Starting BANKY with PM2..."

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

# Only stop BANKY's own processes, never touch other apps
pm2 delete banky-api 2>/dev/null || true
pm2 delete banky-scheduler 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

# Set up PM2 to start on boot (only for current user)
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup 2>/dev/null || true
print_ok "BANKY services started with PM2"

# Verify services are running
sleep 3
BANKY_API_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    apps = json.load(sys.stdin)
    status = next((a['pm2_env']['status'] for a in apps if a['name']=='banky-api'), 'unknown')
    print(status)
except:
    print('unknown')
" 2>/dev/null) || BANKY_API_STATUS="unknown"

if [ "$BANKY_API_STATUS" = "online" ]; then
    print_ok "banky-api is running"
else
    print_warn "banky-api status: ${BANKY_API_STATUS}"
    print_warn "Check logs with: pm2 logs banky-api"
fi

BANKY_SCHED_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    apps = json.load(sys.stdin)
    status = next((a['pm2_env']['status'] for a in apps if a['name']=='banky-scheduler'), 'unknown')
    print(status)
except:
    print('unknown')
" 2>/dev/null) || BANKY_SCHED_STATUS="unknown"

if [ "$BANKY_SCHED_STATUS" = "online" ]; then
    print_ok "banky-scheduler is running"
else
    print_warn "banky-scheduler status: ${BANKY_SCHED_STATUS}"
    print_warn "Check logs with: pm2 logs banky-scheduler"
fi

# ══════════════════════════════════════════════════════════════
#  SSL Certificate (optional)
# ══════════════════════════════════════════════════════════════
echo ""
if command -v certbot >/dev/null 2>&1; then
    read -p "  Set up free SSL certificate with Let's Encrypt? (y/n): " SETUP_SSL
    if [ "$SETUP_SSL" = "y" ] || [ "$SETUP_SSL" = "Y" ]; then
        print_step "Setting up SSL certificate..."
        read -p "  Enter your email for SSL certificate (or press Enter to skip): " SSL_EMAIL
        SSL_SUCCESS=false
        if [ -n "$SSL_EMAIL" ]; then
            certbot --nginx -d "${USER_DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" && SSL_SUCCESS=true || true
        else
            certbot --nginx -d "${USER_DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email && SSL_SUCCESS=true || true
        fi
        if [ "$SSL_SUCCESS" = true ]; then
            print_ok "SSL certificate installed successfully!"
        else
            print_warn "SSL setup failed. Make sure:"
            echo "    1. Your domain ${USER_DOMAIN} points to this server's IP"
            echo "    2. Port 80 is open in your firewall"
            echo "    Retry later with: sudo certbot --nginx -d ${USER_DOMAIN}"
        fi
    fi
else
    print_warn "Certbot not available. Install SSL manually later if needed."
fi

# ══════════════════════════════════════════════════════════════
#  DONE - Summary
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  Your BANKY instance is now running at:"
echo ""
echo "    http://${USER_DOMAIN}"
echo ""
echo "  Open it in your browser to create your first account."
echo ""
echo -e "${BLUE}  ── Useful Commands ──${NC}"
echo "    pm2 status              View running services"
echo "    pm2 logs                View application logs"
echo "    pm2 logs banky-api      View API logs only"
echo "    pm2 restart banky-api   Restart the API"
echo "    pm2 restart all         Restart all BANKY services"
echo ""
if [ "$IS_REINSTALL" = false ]; then
echo -e "${BLUE}  ── Database Info ──${NC}"
echo "    User:     banky"
echo "    Password: (saved in .env)"
echo "    Database: banky"
echo "    Host:     localhost"
echo ""
fi
echo "  Config file: ${APP_DIR}/.env"
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

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

    # ── install.sh: Cross-platform installer ──
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

APP_DIR=$(pwd)

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BANKY - Bank & Sacco Management System${NC}"
echo -e "${BLUE}  Installer${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# ── Detect OS ──
PLATFORM="unknown"
case "$(uname -s)" in
    Linux*)   PLATFORM="linux" ;;
    Darwin*)  PLATFORM="mac" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
esac

echo "  Detected platform: ${PLATFORM}"
echo ""
echo "  Select installation mode:"
echo ""
echo "    1) Local Development (run on this machine - Mac/Windows/Linux)"
echo "    2) Production Server (Ubuntu/Debian with Nginx, PM2, SSL)"
echo ""
read -p "  Enter choice [1-2]: " INSTALL_MODE

if [ "$INSTALL_MODE" != "1" ] && [ "$INSTALL_MODE" != "2" ]; then
    print_err "Invalid choice"
    exit 1
fi

# ══════════════════════════════════════════════════════════════
#  SHARED: Check prerequisites
# ══════════════════════════════════════════════════════════════
print_step "Checking prerequisites..."

MISSING=""

# Check Node.js
if command -v node >/dev/null 2>&1; then
    print_ok "Node.js $(node -v)"
else
    MISSING="${MISSING} Node.js"
    print_err "Node.js not found"
fi

# Check Python 3
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
    print_ok "Python $(python3 --version 2>&1)"
elif command -v python >/dev/null 2>&1; then
    PY_VER=$(python --version 2>&1)
    if echo "$PY_VER" | grep -q "Python 3"; then
        PYTHON_CMD="python"
        print_ok "$PY_VER"
    else
        MISSING="${MISSING} Python3"
        print_err "Python 3 not found (found Python 2)"
    fi
else
    MISSING="${MISSING} Python3"
    print_err "Python 3 not found"
fi

# Check pip
PIP_CMD=""
if command -v pip3 >/dev/null 2>&1; then
    PIP_CMD="pip3"
elif command -v pip >/dev/null 2>&1; then
    PIP_CMD="pip"
fi

if [ -n "$MISSING" ]; then
    echo ""
    print_err "Missing required software:${MISSING}"
    echo ""
    if [ "$PLATFORM" = "mac" ]; then
        echo "  Install with Homebrew:"
        echo "    brew install node python@3.11 postgresql@16"
        echo ""
        echo "  Don't have Homebrew? Install it first:"
        echo "    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    elif [ "$PLATFORM" = "windows" ]; then
        echo "  Download and install:"
        echo "    Node.js:    https://nodejs.org"
        echo "    Python 3:   https://python.org (check 'Add to PATH' during install)"
        echo "    PostgreSQL: https://www.postgresql.org/download/windows/"
    else
        echo "  Install on Ubuntu/Debian:"
        echo "    sudo apt install -y nodejs python3 python3-venv python3-pip postgresql"
    fi
    echo ""
    echo "  After installing, run this script again."
    exit 1
fi

# ══════════════════════════════════════════════════════════════════
#  MODE 1: LOCAL DEVELOPMENT
# ══════════════════════════════════════════════════════════════════
if [ "$INSTALL_MODE" = "1" ]; then

    # ── Re-install detection ──
    IS_REINSTALL=false
    if [ -f .env ]; then
        IS_REINSTALL=true
        print_skip "Existing .env found (your settings are preserved)"
    fi

    # ── Step 1: Environment file ──
    print_step "Step 1/4: Setting up environment..."

    if [ ! -f .env ]; then
        SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "change-me-to-a-random-string-at-least-32-chars")
        cat > .env << ENVEOF
DATABASE_URL=postgresql://banky:banky@localhost:5432/banky
DEPLOYMENT_MODE=enterprise
SESSION_SECRET=${SESSION_SECRET}
DOMAIN=localhost
PORT=5000
ENVEOF
        print_new ".env file created"
        echo ""
        print_warn "IMPORTANT: Edit .env and set your DATABASE_URL"
        echo "           If using local PostgreSQL, create the database first:"
        if [ "$PLATFORM" = "mac" ]; then
            echo "             createdb banky"
        else
            echo "             sudo -u postgres createdb banky"
        fi
    fi

    # ── Step 2: Node.js dependencies ──
    print_step "Step 2/4: Installing frontend dependencies..."
    npm install 2>&1 | tail -5
    print_ok "Node.js dependencies installed"

    # ── Step 3: Python dependencies ──
    print_step "Step 3/4: Installing Python backend dependencies..."

    if [ ! -d "venv" ]; then
        $PYTHON_CMD -m venv venv
        print_new "Python virtual environment created"
    else
        print_skip "Python virtual environment already exists"
    fi

    # Activate venv (cross-platform)
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    elif [ -f "venv/Scripts/activate" ]; then
        source venv/Scripts/activate
    fi

    pip install --upgrade pip -q 2>/dev/null || true
    pip install -r python_backend/requirements.txt -q 2>&1 | tail -3
    deactivate 2>/dev/null || true
    print_ok "Python dependencies installed"

    # ── Step 4: Create directories ──
    print_step "Step 4/4: Setting up directories..."
    mkdir -p python_backend/uploads
    print_ok "Upload directory ready"

    # ── Done ──
    echo ""
    echo -e "${BLUE}================================================================${NC}"
    echo -e "${GREEN}  Local Setup Complete!${NC}"
    echo -e "${BLUE}================================================================${NC}"
    echo ""
    echo "  To start BANKY locally, run:"
    echo ""
    echo "    ./start.sh"
    echo ""
    echo "  Then open: http://localhost:5000"
    echo ""
    if [ "$IS_REINSTALL" = false ]; then
        echo -e "${YELLOW}  IMPORTANT: Before starting, make sure:${NC}"
        echo "    1. PostgreSQL is running on your machine"
        echo "    2. Database 'banky' exists"
        echo "    3. DATABASE_URL in .env matches your PostgreSQL setup"
        echo ""
    fi
    echo "  All features are unlocked. No license key needed."
    echo ""

    exit 0
fi

# ══════════════════════════════════════════════════════════════════
#  MODE 2: PRODUCTION SERVER (Ubuntu/Debian)
# ══════════════════════════════════════════════════════════════════

# Must be root for production
if [ "$(id -u)" -ne 0 ]; then
    print_err "Production mode must be run as root (use: sudo ./install.sh)"
    exit 1
fi

# Check OS
OS_NAME="unknown"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME="${ID:-unknown}"
    echo "  Detected OS: ${PRETTY_NAME:-$OS_NAME}"
fi

if [ "$OS_NAME" != "ubuntu" ] && [ "$OS_NAME" != "debian" ]; then
    print_warn "Production mode is designed for Ubuntu/Debian."
    read -p "  Continue anyway? (y/n): " CONTINUE_ANYWAY
    if [ "$CONTINUE_ANYWAY" != "y" ] && [ "$CONTINUE_ANYWAY" != "Y" ]; then
        exit 0
    fi
fi

# Ask for domain
echo ""
read -p "  Enter your domain (e.g. banky.example.com): " USER_DOMAIN
if [ -z "$USER_DOMAIN" ]; then
    print_err "Domain is required for production setup"
    exit 1
fi

# Re-install detection
IS_REINSTALL=false
if [ -f .env ]; then
    IS_REINSTALL=true
    echo ""
    print_warn "Existing installation detected!"
    print_warn "Your .env, database, and other configs will NOT be overwritten."
    read -p "  Continue with upgrade/re-install? (y/n): " CONTINUE_REINSTALL
    if [ "$CONTINUE_REINSTALL" != "y" ] && [ "$CONTINUE_REINSTALL" != "Y" ]; then
        exit 0
    fi
fi

# Generate secrets (only used for fresh installs)
DB_PASSWORD=$(openssl rand -hex 16)
SESSION_SECRET=$(openssl rand -hex 32)

echo ""
echo "  Installation directory: ${APP_DIR}"
echo "  Domain: ${USER_DOMAIN}"
echo ""

# ── Step 1: System packages ──
print_step "Step 1/9: Checking system packages..."

echo ""
INSTALL_NEEDED=""

check_installed() {
    local name="$1"
    local cmd="$2"
    if command -v "$cmd" >/dev/null 2>&1; then
        local ver
        case "$cmd" in
            node)    ver=$(node -v 2>/dev/null) ;;
            python3) ver=$(python3 --version 2>/dev/null) ;;
            psql)    ver=$(psql --version 2>/dev/null | head -1) ;;
            nginx)   ver="$(nginx -v 2>&1 | cut -d/ -f2)" ;;
            pm2)     ver=$(pm2 -v 2>/dev/null) ;;
            certbot) ver=$(certbot --version 2>/dev/null | head -1) ;;
            *)       ver="installed" ;;
        esac
        print_ok "${name}: ${ver}"
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

if [ -n "$INSTALL_NEEDED" ]; then
    echo ""
    echo "  Will install:${INSTALL_NEEDED}"
    read -p "  Proceed? (y/n): " PROCEED_INSTALL
    if [ "$PROCEED_INSTALL" != "y" ] && [ "$PROCEED_INSTALL" != "Y" ]; then
        exit 0
    fi
    apt update -y
fi

# Install basic build tools if missing
for pkg in curl wget git build-essential software-properties-common; do
    dpkg -s "$pkg" >/dev/null 2>&1 || apt install -y "$pkg" 2>/dev/null || true
done

if [ $HAS_NODE -ne 0 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    print_new "Node.js $(node -v) installed"
fi

if [ $HAS_PYTHON -ne 0 ]; then
    apt install -y python3 python3-venv python3-pip python3-dev
    print_new "Python $(python3 --version) installed"
else
    for pkg in python3-venv python3-pip python3-dev; do
        if ! dpkg -s "$pkg" >/dev/null 2>&1; then
            apt install -y "$pkg" 2>/dev/null || true
        fi
    done
fi

if [ $HAS_POSTGRES -ne 0 ]; then
    apt install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
    print_new "PostgreSQL installed and started"
else
    systemctl is-active --quiet postgresql || systemctl start postgresql
fi

if [ $HAS_NGINX -ne 0 ]; then
    apt install -y nginx
    systemctl enable nginx
    systemctl start nginx
    print_new "Nginx installed"
else
    systemctl is-active --quiet nginx || systemctl start nginx
fi

if [ $HAS_PM2 -ne 0 ]; then
    npm install -g pm2
    print_new "PM2 installed"
fi

if [ $HAS_CERTBOT -ne 0 ]; then
    apt install -y certbot python3-certbot-nginx 2>/dev/null || true
    command -v certbot >/dev/null 2>&1 && print_new "Certbot installed"
fi

# ── Step 2: Database ──
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
    print_new "Database user 'banky' created"
fi

if [ "$DB_EXISTS" = false ]; then
    sudo -u postgres psql -c "CREATE DATABASE banky OWNER banky;" 2>/dev/null
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE banky TO banky;" 2>/dev/null
    print_new "Database 'banky' created"
fi

# ── Step 3: Environment ──
print_step "Step 3/9: Configuring environment..."

if [ -f .env ]; then
    print_skip ".env already exists (your settings are preserved)"
    # Update domain if changed
    CURRENT_DOMAIN=$(grep "^DOMAIN=" .env 2>/dev/null | cut -d= -f2-)
    if [ -n "$CURRENT_DOMAIN" ] && [ "$CURRENT_DOMAIN" != "$USER_DOMAIN" ]; then
        sed -i "s|^DOMAIN=.*|DOMAIN=${USER_DOMAIN}|" .env
        print_ok "Updated DOMAIN to ${USER_DOMAIN}"
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
fi

# ── Step 4: Directories ──
print_step "Step 4/9: Setting up directories..."
mkdir -p python_backend/uploads
print_ok "Upload directory ready"

# ── Step 5: Node.js dependencies ──
print_step "Step 5/9: Installing frontend dependencies..."
npm install 2>&1 | tail -3
print_ok "Node.js dependencies installed"

# ── Step 6: Python dependencies ──
print_step "Step 6/9: Installing Python backend dependencies..."

if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_new "Python virtual environment created"
else
    print_skip "Python virtual environment already exists"
fi

source venv/bin/activate
pip install --upgrade pip -q 2>/dev/null || true
pip install -r python_backend/requirements.txt -q 2>&1 | tail -3
deactivate
print_ok "Python dependencies installed"

# ── Step 7: Build frontend ──
print_step "Step 7/9: Building frontend for production..."
npx vite build 2>&1 | tail -3
print_ok "Frontend built successfully"

# ── Step 8: Nginx ──
print_step "Step 8/9: Configuring Nginx..."

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

# Only remove default if no other sites
SITE_COUNT=$(ls /etc/nginx/sites-enabled/ 2>/dev/null | grep -cv '^banky$' 2>/dev/null || echo "0")
if [ "$SITE_COUNT" -le 1 ] && [ -f /etc/nginx/sites-enabled/default ]; then
    rm -f /etc/nginx/sites-enabled/default
    print_ok "Removed default Nginx placeholder"
else
    print_skip "Other Nginx sites detected - default preserved"
fi

NGINX_TEST=$(nginx -t 2>&1) && NGINX_OK=true || NGINX_OK=false
if [ "$NGINX_OK" = true ]; then
    systemctl reload nginx
    print_ok "Nginx configured for ${USER_DOMAIN}"
else
    echo "$NGINX_TEST"
    print_err "Nginx config test failed!"
    LATEST_BACKUP=$(ls -t /etc/nginx/sites-available/banky.backup.* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        cp "$LATEST_BACKUP" /etc/nginx/sites-available/banky
        nginx -t 2>&1 && systemctl reload nginx && print_ok "Previous config restored" || true
    fi
fi

# ── Step 9: PM2 ──
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

pm2 delete banky-api 2>/dev/null || true
pm2 delete banky-scheduler 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup 2>/dev/null || true
print_ok "BANKY services started with PM2"

sleep 3
pm2 list 2>/dev/null | grep -E "banky-api|banky-scheduler" || true

# ── SSL (optional) ──
echo ""
if command -v certbot >/dev/null 2>&1; then
    read -p "  Set up free SSL certificate with Let's Encrypt? (y/n): " SETUP_SSL
    if [ "$SETUP_SSL" = "y" ] || [ "$SETUP_SSL" = "Y" ]; then
        print_step "Setting up SSL certificate..."
        read -p "  Enter your email for SSL: " SSL_EMAIL
        if [ -n "$SSL_EMAIL" ]; then
            certbot --nginx -d "${USER_DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" && print_ok "SSL installed!" || {
                print_warn "SSL failed. Make sure your domain points to this server."
                echo "    Retry: sudo certbot --nginx -d ${USER_DOMAIN}"
            }
        fi
    fi
fi

# ── Done ──
echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  BANKY is running at: http://${USER_DOMAIN}"
echo ""
echo "  Commands:"
echo "    pm2 status              Check services"
echo "    pm2 logs banky-api      View API logs"
echo "    pm2 restart all         Restart services"
echo ""
if [ "$IS_REINSTALL" = false ]; then
echo "  Database:"
echo "    User: banky | DB: banky | Host: localhost"
echo "    Password saved in .env"
echo ""
fi
echo "  Config: ${APP_DIR}/.env"
echo "  All features unlocked. No license key needed."
echo ""

fi
INSTALLSCRIPT
    chmod +x packages/codecanyon/banky/install.sh

    # ── start.sh: Cross-platform dev start script ──
    cat > packages/codecanyon/banky/start.sh << 'STARTSCRIPT'
#!/bin/bash

APP_DIR=$(pwd)

echo ""
echo "  Starting BANKY..."
echo ""

# Find python command
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
echo "  Starting API server..."
$PYTHON_CMD -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --app-dir python_backend &
BACKEND_PID=$!

# Start scheduler
echo "  Starting scheduler..."
cd python_backend && $PYTHON_CMD scheduler.py &
SCHEDULER_PID=$!
cd "$APP_DIR"

# Start frontend dev server
echo "  Starting frontend..."
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

    # ── ecosystem.config.js for manual PM2 setup ──
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

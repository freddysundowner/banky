#!/bin/bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  BANKY - Bank & Sacco Management System${NC}"
    echo -e "${BLUE}  Installation Script${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${GREEN}>>> $1${NC}"
}

print_warn() {
    echo -e "${YELLOW}    ⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}    ✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}    ✓ $1${NC}"
}

UPDATE_MODE=false
if [ "$1" = "--update" ]; then
    UPDATE_MODE=true
fi

print_header

# ── Check prerequisites ──────────────────────────────────────────

print_step "Checking prerequisites..."

MISSING=false

if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    print_success "Node.js $NODE_VER"
else
    print_error "Node.js is not installed (v18+ required)"
    echo "         Install: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    MISSING=true
fi

if command -v python3 >/dev/null 2>&1; then
    PY_VER=$(python3 --version)
    print_success "$PY_VER"
else
    print_error "Python 3 is not installed (v3.11+ required)"
    echo "         Install: sudo apt install -y python3.11 python3.11-venv python3-pip"
    MISSING=true
fi

if command -v psql >/dev/null 2>&1; then
    print_success "PostgreSQL client found"
else
    print_warn "PostgreSQL client not found locally (OK if using remote database)"
fi

if command -v pm2 >/dev/null 2>&1; then
    print_success "PM2 process manager found"
else
    print_warn "PM2 not found - will install globally"
    sudo npm install -g pm2
    print_success "PM2 installed"
fi

if command -v nginx >/dev/null 2>&1; then
    print_success "Nginx found"
else
    print_warn "Nginx not found - install with: sudo apt install -y nginx"
fi

if [ "$MISSING" = true ]; then
    echo ""
    print_error "Missing required dependencies. Please install them and re-run this script."
    exit 1
fi

# ── Environment configuration ────────────────────────────────────

print_step "Setting up environment..."

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        print_success "Created .env from template"
        print_warn "IMPORTANT: Edit .env with your database credentials and settings"
        print_warn "Run: nano .env"
    else
        print_error "No .env.example found. Cannot create environment file."
        exit 1
    fi
else
    print_success ".env file already exists"
fi

source .env 2>/dev/null || true

if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL is not set in .env - please configure it first"
    echo ""
    echo "  Edit your .env file:"
    echo "    nano .env"
    echo ""
    echo "  Then re-run this script:"
    echo "    ./install.sh"
    exit 1
fi

# ── Create Python virtual environment ────────────────────────────

print_step "Setting up Python virtual environment..."

if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_success "Created virtual environment"
else
    print_success "Virtual environment already exists"
fi

source venv/bin/activate

# ── Install backend dependencies ─────────────────────────────────

print_step "Installing backend dependencies..."

if [ -f python_backend/requirements.txt ]; then
    pip install --upgrade pip -q
    pip install -r python_backend/requirements.txt -q
    print_success "Backend dependencies installed"
else
    print_error "python_backend/requirements.txt not found"
    exit 1
fi

# ── Install frontend dependencies & build ────────────────────────

print_step "Installing frontend dependencies..."

if [ -f package.json ]; then
    npm install --silent 2>/dev/null
    print_success "Frontend dependencies installed"
else
    print_warn "No package.json found - skipping frontend install"
fi

print_step "Building frontend for production..."

if npm run build 2>/dev/null; then
    print_success "Frontend built to dist/public/"
else
    print_warn "Frontend build failed or not configured - check if dist/public/ exists"
fi

# ── Database setup ───────────────────────────────────────────────

print_step "Setting up database..."

cd python_backend

if python3 -c "
from models.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text('SELECT 1'))
    print('Connection successful')
" 2>/dev/null; then
    print_success "Database connection verified"
else
    print_error "Cannot connect to database. Check DATABASE_URL in .env"
    cd ..
    exit 1
fi

print_step "Running database migrations..."

python3 -c "
from main import app
print('Migrations complete')
" 2>/dev/null && print_success "Database migrations applied" || print_warn "Migration check - application will run migrations on first start"

cd ..

# ── Set up PM2 ecosystem ─────────────────────────────────────────

print_step "Configuring PM2 process manager..."

if [ ! -f ecosystem.config.js ]; then
    print_warn "ecosystem.config.js not found in project root"
fi

# ── Create scripts directory ─────────────────────────────────────

print_step "Setting up utility scripts..."

mkdir -p scripts logs backups
chmod +x scripts/*.sh 2>/dev/null || true
chmod +x install.sh 2>/dev/null || true

print_success "Utility scripts and directories ready"

# ── Final summary ────────────────────────────────────────────────

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$UPDATE_MODE" = true ]; then
    echo "  Update applied successfully."
    echo ""
    echo "  Restart the application:"
    echo "    pm2 restart all"
    echo ""
else
    echo "  Next steps:"
    echo ""
    echo "  1. Edit your .env file (if you haven't already):"
    echo "       nano .env"
    echo ""
    echo "  2. Start the application:"
    echo "       pm2 start ecosystem.config.js"
    echo "       pm2 save"
    echo "       pm2 startup"
    echo ""
    echo "  3. Set up Nginx (see nginx/banky.conf template):"
    echo "       sudo cp nginx/banky.conf /etc/nginx/sites-available/banky"
    echo "       sudo ln -s /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/"
    echo "       sudo nginx -t && sudo systemctl reload nginx"
    echo ""
    echo "  4. Set up SSL:"
    echo "       sudo apt install -y certbot python3-certbot-nginx"
    echo "       sudo certbot --nginx -d yoursite.com"
    echo ""
    echo "  5. Open http://your-server-ip:5000 to register your organization"
    echo ""
fi

echo "  For help: See the documentation at /docs or contact support."
echo ""

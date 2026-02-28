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

APP_DIR=$(pwd)
REQUIRED_PYTHON="3.11.9"
DB_NAME="bankykit"
DB_PASSWORD="bankykit"

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BankyKit - Bank & Sacco Management System${NC}"
echo -e "${BLUE}  Installer${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# ── Detect platform ──
PLATFORM="linux"
case "$(uname -s)" in
    Darwin*)  PLATFORM="mac" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
esac
echo "  Platform: ${PLATFORM}"

# ══════════════════════════════════════════════════════════════
#  Step 1/6: Check prerequisites
# ══════════════════════════════════════════════════════════════
print_step "Step 1/6: Checking prerequisites..."

MISSING=""

if command -v node >/dev/null 2>&1; then
    print_ok "Node.js $(node -v)"
else
    print_warn "Node.js not found — attempting automatic installation..."

    NODE_INSTALLED=0

    if [ "$PLATFORM" = "linux" ]; then
        if command -v apt-get >/dev/null 2>&1; then
            echo "    Detected apt — installing Node.js 20.x via NodeSource..."
            if curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1 && \
               sudo apt-get install -y nodejs >/dev/null 2>&1; then
                NODE_INSTALLED=1
            fi
        elif command -v dnf >/dev/null 2>&1; then
            echo "    Detected dnf — installing Node.js 20.x via NodeSource..."
            if curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1 && \
               sudo dnf install -y nodejs >/dev/null 2>&1; then
                NODE_INSTALLED=1
            fi
        elif command -v yum >/dev/null 2>&1; then
            echo "    Detected yum — installing Node.js 20.x via NodeSource..."
            if curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1 && \
               sudo yum install -y nodejs >/dev/null 2>&1; then
                NODE_INSTALLED=1
            fi
        fi
    elif [ "$PLATFORM" = "mac" ]; then
        if command -v brew >/dev/null 2>&1; then
            echo "    Detected Homebrew — installing Node.js..."
            if brew install node >/dev/null 2>&1; then
                NODE_INSTALLED=1
            fi
        fi
    fi

    # Fallback: nvm (works on any Linux/macOS)
    if [ "$NODE_INSTALLED" = "0" ]; then
        echo "    Falling back to nvm installation..."
        export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
        if [ ! -d "$NVM_DIR" ]; then
            curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash >/dev/null 2>&1
        fi
        # shellcheck disable=SC1091
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        if command -v nvm >/dev/null 2>&1; then
            nvm install 20 >/dev/null 2>&1 && nvm use 20 >/dev/null 2>&1 && NODE_INSTALLED=1
        fi
    fi

    if [ "$NODE_INSTALLED" = "1" ] && command -v node >/dev/null 2>&1; then
        print_ok "Node.js $(node -v) installed successfully"
    else
        MISSING="${MISSING} Node.js"
        print_err "Could not install Node.js automatically"
        echo ""
        if [ "$PLATFORM" = "mac" ]; then
            echo "  Install manually:"
            echo "    brew install node"
        elif [ "$PLATFORM" = "windows" ]; then
            echo "  Download and install:"
            echo "    Node.js: https://nodejs.org"
        else
            echo "  Install manually on Ubuntu/Debian:"
            echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
            echo "    sudo apt install -y nodejs"
        fi
        echo ""
        echo "  After installing, run this script again."
    fi
fi

# ── Python: find 3.11+, or use pyenv to install it ──────────
PYTHON_CMD=""

for _candidate in python3.13 python3.12 python3.11 python3 python; do
    if command -v "$_candidate" >/dev/null 2>&1; then
        _major=$("$_candidate" -c "import sys; print(sys.version_info.major)" 2>/dev/null || echo 0)
        _minor=$("$_candidate" -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo 0)
        if [ "$_major" -ge 3 ] && [ "$_minor" -ge 11 ]; then
            PYTHON_CMD="$_candidate"
            print_ok "$("$_candidate" --version) (using $_candidate)"
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    print_warn "No Python 3.11+ found on system — using pyenv to install Python ${REQUIRED_PYTHON}"

    export PYENV_ROOT="${PYENV_ROOT:-$HOME/.pyenv}"
    export PATH="$PYENV_ROOT/bin:$PATH"

    if ! command -v pyenv >/dev/null 2>&1; then
        echo "    Installing pyenv..."
        if command -v curl >/dev/null 2>&1; then
            curl -fsSL https://pyenv.run | bash
        elif command -v wget >/dev/null 2>&1; then
            wget -qO- https://pyenv.run | bash
        else
            print_err "Neither curl nor wget found — cannot install pyenv"
            print_err "Please install Python 3.11+ manually and re-run this script"
            exit 1
        fi
        print_ok "pyenv installed"
    else
        print_skip "pyenv already installed ($(pyenv --version))"
    fi

    eval "$(pyenv init -)"

    if pyenv versions --bare | grep -q "^${REQUIRED_PYTHON}$"; then
        print_skip "Python ${REQUIRED_PYTHON} already installed in pyenv"
    else
        echo "    Installing Python ${REQUIRED_PYTHON} via pyenv (this may take a few minutes)..."
        pyenv install "$REQUIRED_PYTHON"
        print_ok "Python ${REQUIRED_PYTHON} installed"
    fi

    pyenv local "$REQUIRED_PYTHON"
    PYTHON_CMD="$PYENV_ROOT/versions/${REQUIRED_PYTHON}/bin/python3"
    print_ok "Using Python $($PYTHON_CMD --version) from pyenv"
fi

if [ -z "$PYTHON_CMD" ]; then
    MISSING="${MISSING} Python3"
    print_err "Python 3 not found and pyenv install failed"
fi

if [ -n "$MISSING" ]; then
    echo ""
    print_err "Could not satisfy all requirements:${MISSING}"
    echo ""
    echo "  Please install the missing software and run this script again."
    exit 1
fi

# ══════════════════════════════════════════════════════════════
#  Step 2/6: Environment configuration
# ══════════════════════════════════════════════════════════════
print_step "Step 2/6: Setting up environment..."

if [ -f .env ]; then
    print_skip ".env already exists (your settings are preserved)"
    # Inject any variables that exist in .env.example but are missing from .env
    while IFS= read -r line; do
        # Skip comments and blank lines
        [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
        key="${line%%=*}"
        if ! grep -q "^${key}=" .env 2>/dev/null; then
            echo "$line" >> .env
            print_ok "Added missing variable: ${key}"
        fi
    done < .env.example
else
    SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "change-me-to-a-random-string-at-least-32-chars")
    cp .env.example .env
    if [ "$PLATFORM" = "mac" ] || [ "$PLATFORM" = "windows" ]; then
        sed -i.bak "s|SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" .env 2>/dev/null || true
        rm -f .env.bak
    else
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" .env
    fi
    print_ok ".env file created from template"
fi

# ══════════════════════════════════════════════════════════════
#  Step 3/6: Install Node.js dependencies
# ══════════════════════════════════════════════════════════════
print_step "Step 3/6: Installing frontend dependencies..."

npm install 2>&1 | tail -5
print_ok "Node.js dependencies installed"

# ══════════════════════════════════════════════════════════════
#  Step 4/6: Install Python dependencies
# ══════════════════════════════════════════════════════════════
print_step "Step 4/6: Installing Python backend dependencies..."

VENV_PYTHON=""
if [ -f "venv/bin/python3" ]; then
    VENV_PYTHON="venv/bin/python3"
elif [ -f "venv/Scripts/python.exe" ]; then
    VENV_PYTHON="venv/Scripts/python.exe"
fi

if [ -d "venv" ] && [ -n "$VENV_PYTHON" ]; then
    _venv_major=$("$VENV_PYTHON" -c "import sys; print(sys.version_info.major)" 2>/dev/null || echo 0)
    _venv_minor=$("$VENV_PYTHON" -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo 0)
    if [ "$_venv_major" -ge 3 ] && [ "$_venv_minor" -ge 11 ]; then
        print_skip "Virtual environment already exists ($("$VENV_PYTHON" --version))"
    else
        print_warn "Existing venv uses Python $("$VENV_PYTHON" --version 2>&1) — recreating with $($PYTHON_CMD --version)"
        rm -rf venv
        $PYTHON_CMD -m venv venv
        print_ok "Virtual environment recreated ($($PYTHON_CMD --version))"
    fi
else
    _py_major=$($PYTHON_CMD -c "import sys; print(sys.version_info.major)" 2>/dev/null || echo "3")
    _py_minor=$($PYTHON_CMD -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo "")

    _install_venv_pkg() {
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get install -y "python${_py_major}.${_py_minor}-venv" >/dev/null 2>&1 || \
            sudo apt-get install -y python3-venv >/dev/null 2>&1 || true
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y "python${_py_major}-venv" >/dev/null 2>&1 || \
            sudo dnf install -y python3-venv >/dev/null 2>&1 || true
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y "python${_py_major}-venv" >/dev/null 2>&1 || \
            sudo yum install -y python3-venv >/dev/null 2>&1 || true
        fi
    }

    if $PYTHON_CMD -m venv venv 2>/dev/null; then
        print_ok "Python virtual environment created ($($PYTHON_CMD --version))"
    else
        print_warn "venv creation failed — installing python${_py_major}.${_py_minor}-venv package..."
        _install_venv_pkg
        rm -rf venv
        if $PYTHON_CMD -m venv venv 2>&1; then
            print_ok "Python virtual environment created ($($PYTHON_CMD --version))"
        else
            print_err "Could not create Python virtual environment."
            echo "  Run manually: sudo apt install python${_py_major}.${_py_minor}-venv"
            exit 1
        fi
    fi
fi

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
fi

pip install --upgrade pip -q 2>/dev/null || true

if pip install -r python_backend/requirements.txt 2>&1; then
    print_ok "Python dependencies installed"
else
    echo ""
    print_err "Failed to install Python dependencies"
    echo ""
    echo "  Try running manually:"
    echo "    source venv/bin/activate"
    echo "    pip install -r python_backend/requirements.txt"
    deactivate 2>/dev/null || true
    exit 1
fi

deactivate 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
#  Step 5/6: PostgreSQL setup + database + migrations
# ══════════════════════════════════════════════════════════════
print_step "Step 5/6: Setting up database..."

# ── Install PostgreSQL if missing ────────────────────────────
if ! command -v psql >/dev/null 2>&1; then
    print_warn "PostgreSQL not found — installing..."
    if [ "$PLATFORM" = "mac" ]; then
        if command -v brew >/dev/null 2>&1; then
            brew install postgresql@15 -q
            brew services start postgresql@15
            export PATH="/opt/homebrew/opt/postgresql@15/bin:/usr/local/opt/postgresql@15/bin:$PATH"
            print_ok "PostgreSQL installed and started (via Homebrew)"
        else
            print_err "Homebrew not found. Install it first: https://brew.sh"
            print_err "Then re-run this script."
            exit 1
        fi
    elif [ "$PLATFORM" = "linux" ]; then
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update -q
            sudo apt-get install -y postgresql postgresql-contrib -q
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y postgresql-server postgresql-contrib
            sudo postgresql-setup --initdb 2>/dev/null || true
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y postgresql-server postgresql-contrib
            sudo postgresql-setup initdb 2>/dev/null || true
        else
            print_err "No supported package manager found (apt/dnf/yum). Install PostgreSQL manually."
            exit 1
        fi
        sudo systemctl enable postgresql
        sudo systemctl start postgresql
        print_ok "PostgreSQL installed and started"
    else
        print_err "Automatic PostgreSQL install is not supported on Windows."
        echo "    Download from: https://www.postgresql.org/download/windows/"
        exit 1
    fi
else
    print_ok "PostgreSQL $(psql --version | awk '{print $3}')"
fi

# ── Ensure PostgreSQL is running ─────────────────────────────
if ! pg_isready -q 2>/dev/null; then
    print_warn "PostgreSQL is not running — attempting to start..."
    if [ "$PLATFORM" = "mac" ]; then
        brew services start postgresql@15 2>/dev/null || brew services start postgresql 2>/dev/null || true
    elif [ "$PLATFORM" = "linux" ]; then
        sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start 2>/dev/null || true
    fi
    sleep 2
    if pg_isready -q 2>/dev/null; then
        print_ok "PostgreSQL started"
    else
        print_err "Could not start PostgreSQL. Please start it manually and re-run."
        exit 1
    fi
fi

# ── Connect to PostgreSQL and ensure password is set ─────────
# Strategy:
#   1. Peer auth works (fresh install) → set password, done.
#   2. TCP with known password works (re-run) → already set up, done.
#   3. Neither works → temporarily use trust auth to force-set the
#      password, then switch back and connect via TCP. Fully automatic.

_pg_hba_find() {
    local hba
    # Ask PostgreSQL directly (only works when peer auth is still open)
    hba=$(sudo -u postgres psql -w -tAc "SHOW hba_file;" 2>/dev/null | tr -d ' \n')
    if [ -n "$hba" ] && [ -f "$hba" ]; then echo "$hba"; return; fi
    # Search common installation paths across distros
    for candidate in \
        /etc/postgresql/*/main/pg_hba.conf \
        /etc/postgresql/pg_hba.conf \
        /var/lib/pgsql/*/data/pg_hba.conf \
        /var/lib/pgsql/data/pg_hba.conf \
        /usr/local/pgsql/data/pg_hba.conf \
        /var/lib/postgresql/*/main/pg_hba.conf; do
        # expand glob
        for f in $candidate; do
            [ -f "$f" ] && echo "$f" && return
        done
    done
    # Last resort: recursive search
    find /etc /var/lib/pgsql /var/lib/postgresql /usr/local/pgsql \
        -name pg_hba.conf 2>/dev/null | head -1
}

_pg_reload() {
    sudo systemctl reload postgresql 2>/dev/null \
    || sudo service postgresql reload 2>/dev/null \
    || true
    sleep 1
}

if [ "$PLATFORM" = "linux" ] && sudo -u postgres psql -w -c '\q' 2>/dev/null; then
    # ── Case 1: Peer auth works ───────────────────────────────
    PSQL_CMD="sudo -u postgres psql"
    CREATEDB_CMD="sudo -u postgres createdb"
    PEER_AUTH=1
    sudo -u postgres psql -c "ALTER USER postgres PASSWORD '${DB_PASSWORD}';" >/dev/null 2>&1
    print_ok "PostgreSQL password set to '${DB_PASSWORD}'"

elif PGPASSWORD="$DB_PASSWORD" psql -U postgres -h 127.0.0.1 -p 5432 -w -c '\q' 2>/dev/null; then
    # ── Case 2: TCP with correct password already works ───────
    export PGPASSWORD="$DB_PASSWORD"
    PSQL_CMD="psql -U postgres -h 127.0.0.1 -p 5432"
    CREATEDB_CMD="createdb -U postgres -h 127.0.0.1 -p 5432"
    PEER_AUTH=0
    print_ok "PostgreSQL connected via TCP (password already set)"

else
    # ── Case 3: scram-sha-256 everywhere, password unknown ────
    # Temporarily switch local postgres auth to trust, set the
    # password, then restore scram-sha-256.
    print_warn "PostgreSQL requires password — setting it automatically..."
    PG_HBA=$(_pg_hba_find)
    if [ -z "$PG_HBA" ] || [ ! -f "$PG_HBA" ]; then
        print_err "Cannot locate pg_hba.conf. Please set the postgres password manually:"
        print_err "  sudo -u postgres psql -c \"ALTER USER postgres PASSWORD '${DB_PASSWORD}';\""
        exit 1
    fi
    # Patch local postgres line to trust
    sudo sed -i \
        "s|^\(local[[:space:]]\+all[[:space:]]\+postgres[[:space:]]\+\).*|\1trust|" \
        "$PG_HBA"
    _pg_reload
    sudo -u postgres psql -c "ALTER USER postgres PASSWORD '${DB_PASSWORD}';" >/dev/null 2>&1
    print_ok "PostgreSQL password set to '${DB_PASSWORD}'"
    # Restore scram-sha-256
    sudo sed -i \
        "s|^\(local[[:space:]]\+all[[:space:]]\+postgres[[:space:]]\+\)trust|\1scram-sha-256|" \
        "$PG_HBA"
    _pg_reload
    # Now connect via TCP with the freshly set password
    if PGPASSWORD="$DB_PASSWORD" psql -U postgres -h 127.0.0.1 -p 5432 -w -c '\q' 2>/dev/null; then
        export PGPASSWORD="$DB_PASSWORD"
        PSQL_CMD="psql -U postgres -h 127.0.0.1 -p 5432"
        CREATEDB_CMD="createdb -U postgres -h 127.0.0.1 -p 5432"
        PEER_AUTH=0
    else
        print_err "Still cannot connect after setting password. Check PostgreSQL is running."
        exit 1
    fi
fi

# ── Ensure a role exists for the current OS user (peer-auth installs) ──
CURRENT_OS_USER=$(whoami)
if [ "$PLATFORM" = "linux" ] && [ "${PEER_AUTH:-0}" = "1" ]; then
    if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${CURRENT_OS_USER}'" 2>/dev/null | grep -q 1; then
        sudo -u postgres psql -c "CREATE ROLE \"${CURRENT_OS_USER}\" WITH SUPERUSER LOGIN;" >/dev/null 2>&1
        print_ok "PostgreSQL role '${CURRENT_OS_USER}' created"
    fi
fi

# ── Create database if it doesn't exist ──────────────────────
if $PSQL_CMD -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    print_skip "Database '${DB_NAME}' already exists"
else
    print_warn "Database '${DB_NAME}' not found — creating..."
    $CREATEDB_CMD "$DB_NAME"
    print_ok "Database '${DB_NAME}' created"
fi

# ── Write DATABASE_URL to .env if not already set ────────────
source .env 2>/dev/null || true
if [ "$PLATFORM" = "linux" ]; then
    NEW_DB_URL="postgresql://postgres:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
else
    NEW_DB_URL="postgresql://localhost:5432/${DB_NAME}"
fi

# On Linux: always enforce 127.0.0.1 + password so TCP is used (socket auth is gone).
# On Mac/Windows: only update if empty or clearly using an old socket/no-auth URL.
_should_update_db_url=0
if [ "$PLATFORM" = "linux" ]; then
    # Always update on Linux — must use 127.0.0.1, not localhost (socket).
    _should_update_db_url=1
elif [ -z "$DATABASE_URL" ] || echo "$DATABASE_URL" | grep -qE "(localhost|///|127\.0\.0\.1)[^?]*$" && ! echo "$DATABASE_URL" | grep -q "@"; then
    _should_update_db_url=1
fi

if [ "$_should_update_db_url" = "1" ]; then
    if grep -q "^DATABASE_URL=" .env 2>/dev/null; then
        if [ "$PLATFORM" = "mac" ] || [ "$PLATFORM" = "windows" ]; then
            sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=${NEW_DB_URL}|" .env
            rm -f .env.bak
        else
            sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${NEW_DB_URL}|" .env
        fi
    else
        echo "DATABASE_URL=${NEW_DB_URL}" >> .env
    fi
    print_ok "DATABASE_URL set to: ${NEW_DB_URL}"
else
    print_skip "DATABASE_URL already configured (non-Linux)"
fi

# ── Run database migrations ───────────────────────────────────
echo "    Running database migrations..."
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
fi

if python3 -c "
import sys, os
sys.path.insert(0, 'python_backend')
os.chdir('python_backend')
from dotenv import load_dotenv
load_dotenv('../.env')

# Must import all models before create_all so SQLAlchemy knows about them
from models.database import engine, Base
import models.master
import models.tenant

# Step 1: create all tables (safe — does nothing if tables already exist)
Base.metadata.create_all(bind=engine)

# Step 2: run incremental column migrations
from main import run_master_migrations
run_master_migrations()
print('Migrations complete')
" 2>&1; then
    print_ok "Database migrations applied"
else
    print_warn "Migration check — app will also run migrations on first start"
fi

deactivate 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
#  Step 6/6: Build application
# ══════════════════════════════════════════════════════════════
print_step "Step 6/6: Building application..."

mkdir -p python_backend/uploads logs backups

# Set VITE_PRODUCTION_MODE based on install type (check if DB name ends with -demo)
if echo "$DB_NAME" | grep -q "\-demo$"; then
    if grep -q "^VITE_PRODUCTION_MODE=" .env 2>/dev/null; then
        sed -i "s|^VITE_PRODUCTION_MODE=.*|VITE_PRODUCTION_MODE=demo|" .env
    else
        echo "VITE_PRODUCTION_MODE=demo" >> .env
    fi
    export VITE_PRODUCTION_MODE=demo
    print_ok "Demo mode enabled — login page will show demo credentials"
else
    if grep -q "^VITE_PRODUCTION_MODE=" .env 2>/dev/null; then
        sed -i "s|^VITE_PRODUCTION_MODE=.*|VITE_PRODUCTION_MODE=|" .env
    fi
    export VITE_PRODUCTION_MODE=
fi

npx vite build 2>&1 | tail -3
print_ok "Frontend built successfully"

# ── Switch local PostgreSQL auth to scram-sha-256 (done last so it
#    does not break peer-auth calls used earlier in this script) ──
if [ "$PLATFORM" = "linux" ]; then
    PG_HBA=$($PSQL_CMD -tAc "SHOW hba_file;" 2>/dev/null | tr -d ' ')
    if [ -n "$PG_HBA" ] && [ -f "$PG_HBA" ]; then
        sudo sed -i "s/^\(local[[:space:]]\+all[[:space:]]\+postgres[[:space:]]\+\)peer/\1scram-sha-256/" "$PG_HBA"
        sudo sed -i "s/^\(local[[:space:]]\+all[[:space:]]\+all[[:space:]]\+\)peer/\1scram-sha-256/" "$PG_HBA"
        sudo sed -i "s/^\(local[[:space:]]\+replication[[:space:]]\+all[[:space:]]\+\)peer/\1scram-sha-256/" "$PG_HBA"
        sudo systemctl reload postgresql 2>/dev/null || sudo service postgresql reload 2>/dev/null || true
        print_ok "PostgreSQL local auth switched to scram-sha-256"
    fi
fi

# ══════════════════════════════════════════════════════════════
#  Done
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  To start BankyKit:"
echo ""
echo "    ./start.sh"
echo ""
echo "  Then open: http://localhost:5000"
echo ""
echo "  For production deployment (Nginx, PM2, SSL), see the"
echo "  deployment guide in the documentation."
echo ""
echo "  All features are unlocked. No license key needed."
echo ""

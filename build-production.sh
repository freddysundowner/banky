#!/bin/bash

set -e

echo "========================================"
echo "  BANKY Production Build Script"
echo "========================================"
echo ""

show_menu() {
    echo "Select build type:"
    echo "  1) SaaS Build (for your cloud deployment)"
    echo "  2) Compiled Build (enterprise self-hosting)"
    echo "  3) CodeCanyon Build (source code for developers)"
    echo "  4) Build All"
    echo "  5) Exit"
    echo ""
    read -p "Enter choice [1-5]: " choice
}

build_frontend() {
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
DATABASE_URL=postgresql://user:password@host:5432/banky_master
DEPLOYMENT_MODE=saas
SESSION_SECRET=your-secure-session-secret
NEON_API_KEY=your-neon-api-key

# Optional: SMS Gateway
SMS_API_KEY=
SMS_SENDER_ID=

# Optional: M-Pesa Integration
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_SHORTCODE=

# Optional: Stripe (for subscription payments)
STRIPE_SECRET_KEY=

# Optional: Brevo (for emails)
BREVO_API_KEY=
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

    cat > packages/saas/README.txt << 'EOF'
BANKY SaaS Deployment
=====================

For deploying BANKY as your own SaaS platform.

SETUP:
1. Set up PostgreSQL database (Neon recommended for multi-tenant)
2. Copy .env.example to .env and configure
3. Install Python dependencies: cd backend && pip install -r requirements.txt
4. Serve /frontend/ as static files via Nginx on your app subdomain
5. Serve /admin/ as static files via Nginx on your admin subdomain
6. Start API: pm2 start ecosystem.config.js

STRUCTURE:
- /frontend/     - Main app static files (serve via Nginx)
- /admin/        - Admin panel static files (serve via Nginx)
- /backend/      - Python API (runs on port 8000)
- ecosystem.config.js - PM2 process config
EOF

    echo ">>> SaaS build complete: packages/saas/"
}

build_compiled() {
    echo ""
    echo "========================================"
    echo "  Building Compiled Enterprise Version"
    echo "========================================"
    echo ""
    echo "Note: Enterprise version does NOT include admin panel."
    echo "      Admin panel is only for SaaS multi-tenant management."
    
    if ! command -v pyinstaller &> /dev/null; then
        echo ">>> Installing PyInstaller..."
        pip install pyinstaller
    fi
    
    build_frontend
    
    echo ""
    echo ">>> Compiling Python backend to binary..."
    
    local PROJECT_ROOT="$(pwd)"
    
    rm -rf packages/enterprise
    mkdir -p packages/enterprise
    
    cat > python_backend/banky_server.py << 'ENTRYPOINT'
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)
ENTRYPOINT

    BINARY_BUILD=false
    
    cd python_backend
    pyinstaller --onefile \
        --name banky-server \
        --hidden-import=uvicorn \
        --hidden-import=uvicorn.logging \
        --hidden-import=uvicorn.loops \
        --hidden-import=uvicorn.loops.auto \
        --hidden-import=uvicorn.protocols \
        --hidden-import=uvicorn.protocols.http \
        --hidden-import=uvicorn.protocols.http.auto \
        --hidden-import=uvicorn.protocols.websockets \
        --hidden-import=uvicorn.protocols.websockets.auto \
        --hidden-import=uvicorn.lifespan \
        --hidden-import=uvicorn.lifespan.on \
        --hidden-import=sqlalchemy \
        --hidden-import=sqlalchemy.dialects.postgresql \
        --hidden-import=psycopg2 \
        --hidden-import=pydantic \
        --hidden-import=fastapi \
        --hidden-import=starlette \
        --hidden-import=bcrypt \
        --hidden-import=httpx \
        --hidden-import=requests \
        --hidden-import=reportlab \
        --hidden-import=pypdf \
        --collect-all=uvicorn \
        --collect-all=fastapi \
        --collect-all=starlette \
        --collect-all=pydantic \
        banky_server.py 2>&1 && BINARY_BUILD=true || BINARY_BUILD=false
    cd "$PROJECT_ROOT"
    
    if [ "$BINARY_BUILD" = true ] && [ -f python_backend/dist/banky-server ]; then
        cp python_backend/dist/banky-server packages/enterprise/
        rm -rf python_backend/build python_backend/dist python_backend/*.spec python_backend/banky_server.py
    else
        echo ">>> PyInstaller failed. Creating source package instead..."
        BINARY_BUILD=false
        cp -r python_backend packages/enterprise/backend
        rm -f packages/enterprise/backend/banky_server.py
        find packages/enterprise/backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        find packages/enterprise/backend -type f -name "*.pyc" -delete 2>/dev/null || true
        rm -rf packages/enterprise/backend/uploads 2>/dev/null || true
        rm -rf packages/enterprise/backend/tests 2>/dev/null || true
    fi
    
    cp -r dist/public packages/enterprise/frontend
    
    cat > packages/enterprise/.env.example << 'EOF'
DATABASE_URL=postgresql://user:password@host:5432/banky
DEPLOYMENT_MODE=enterprise
# License key provided by admin after purchase (REQUIRED)
LICENSE_KEY=
SESSION_SECRET=your-secure-session-secret

# Optional: SMS Gateway
SMS_API_KEY=
SMS_SENDER_ID=

# Optional: M-Pesa Integration
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_SHORTCODE=
EOF

    if [ "$BINARY_BUILD" = true ]; then
        cat > packages/enterprise/README.txt << 'EOF'
BANKY Enterprise Edition (Compiled)
=====================================

Self-hosted version for large organizations.

SETUP:
1. Set up PostgreSQL database
2. Copy .env.example to .env and configure
3. Add your LICENSE_KEY to .env (provided at purchase)
4. Serve /frontend/ as static files via Nginx
5. Run: ./banky-server

LICENSE KEY FORMAT: BANKY-{EDITION}-{YEAR}-{ID}
  - BANKY-BAS-2026-XXXXXX = Basic (1,000 members, 5 staff, 1 branch)
  - BANKY-STD-2026-XXXXXX = Standard (5,000 members, 20 staff, 10 branches)
  - BANKY-PRE-2026-XXXXXX = Premium (20,000 members, 100 staff, 50 branches)
  - BANKY-ENT-2026-XXXXXX = Enterprise (Unlimited)

STRUCTURE:
- /frontend/     - Main app static files (serve via Nginx)
- banky-server   - Compiled backend binary

NOTE: Single-organization use. Admin panel is NOT included.
EOF
    else
        cat > packages/enterprise/README.txt << 'EOF'
BANKY Enterprise Edition (Source)
==================================

Self-hosted version for large organizations.

SETUP:
1. Set up PostgreSQL database
2. Install Python 3.11+ and pip
3. Install dependencies: cd backend && pip install -r requirements.txt
4. Copy .env.example to .env and configure
5. Add your LICENSE_KEY to .env (provided at purchase)
6. Serve /frontend/ as static files via Nginx
7. Start API: cd backend && uvicorn main:app --host 0.0.0.0 --port 8000

LICENSE KEY FORMAT: BANKY-{EDITION}-{YEAR}-{ID}
  - BANKY-BAS-2026-XXXXXX = Basic (1,000 members, 5 staff, 1 branch)
  - BANKY-STD-2026-XXXXXX = Standard (5,000 members, 20 staff, 10 branches)
  - BANKY-PRE-2026-XXXXXX = Premium (20,000 members, 100 staff, 50 branches)
  - BANKY-ENT-2026-XXXXXX = Enterprise (Unlimited)

STRUCTURE:
- /frontend/     - Main app static files (serve via Nginx)
- /backend/      - Python API source code

NOTE: Single-organization use. Admin panel is NOT included.
EOF
    fi

    echo ">>> Enterprise build complete: packages/enterprise/"
}

build_codecanyon() {
    echo ""
    echo "========================================"
    echo "  Building CodeCanyon Version"
    echo "========================================"
    
    build_frontend
    build_admin
    
    echo ""
    echo ">>> Creating CodeCanyon source package..."
    
    rm -rf packages/codecanyon
    mkdir -p packages/codecanyon/banky
    
    # Copy all source code
    cp -r client packages/codecanyon/banky/
    cp -r admin-client packages/codecanyon/banky/
    cp -r python_backend packages/codecanyon/banky/
    cp -r landing-page packages/codecanyon/banky/
    cp -r server packages/codecanyon/banky/
    cp -r shared packages/codecanyon/banky/ 2>/dev/null || true
    cp package.json packages/codecanyon/banky/
    cp package-lock.json packages/codecanyon/banky/ 2>/dev/null || true
    cp vite.config.ts packages/codecanyon/banky/
    cp tsconfig.json packages/codecanyon/banky/
    cp tailwind.config.ts packages/codecanyon/banky/ 2>/dev/null || true
    cp postcss.config.js packages/codecanyon/banky/ 2>/dev/null || true
    cp ecosystem.config.js packages/codecanyon/banky/ 2>/dev/null || true
    
    # Clean up unnecessary files
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
    
    # Generate perpetual lifetime license key for CodeCanyon
    CODECANYON_KEY="BANKY-ENT-PERP-$(cat /dev/urandom | tr -dc 'A-Z0-9' | fold -w 8 | head -n 1)"
    echo ">>> Generated CodeCanyon lifetime key: $CODECANYON_KEY"

    # Create env example with pre-filled perpetual key
    cat > packages/codecanyon/banky/.env.example << EOF
# Database
DATABASE_URL=postgresql://user:password@host:5432/banky

# Deployment Mode: 'saas' or 'enterprise'
DEPLOYMENT_MODE=saas

# For SaaS mode - Neon API for multi-tenant database provisioning
NEON_API_KEY=your-neon-api-key

# For Enterprise mode - License key (lifetime key included)
LICENSE_KEY=${CODECANYON_KEY}

# Security
SESSION_SECRET=your-secure-session-secret

# Optional: SMS Gateway
SMS_API_KEY=
SMS_SENDER_ID=

# Optional: M-Pesa Integration
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_SHORTCODE=
EOF

    # Create install script
    cat > packages/codecanyon/banky/install.sh << 'INSTALLSCRIPT'
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

echo "Step 1/5: Installing main app dependencies..."
npm install

echo ""
echo "Step 2/5: Installing admin panel dependencies..."
cd admin-client && npm install && cd ..

echo ""
echo "Step 3/5: Installing landing page dependencies..."
cd landing-page && npm install && cd ..

echo ""
echo "Step 4/5: Installing Python backend dependencies..."
cd python_backend && $PIP_CMD install -r requirements.txt && cd ..

echo ""
echo "Step 5/5: Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file from .env.example"
    echo "Your lifetime license key is already included."
else
    echo ".env already exists"
fi

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your database URL"
echo "  2. For development: ./start.sh"
echo "  3. For production:  See README.md for PM2/Nginx setup"
echo ""
INSTALLSCRIPT
    chmod +x packages/codecanyon/banky/install.sh

    # Create start script (development mode)
    cat > packages/codecanyon/banky/start.sh << 'STARTSCRIPT'
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

# Start admin panel dev server
cd admin-client
npx vite --host 0.0.0.0 --port 3001 &
ADMIN_PID=$!
cd ..

# Start main frontend dev server
npx vite --host 0.0.0.0 --port 5000 &
FRONTEND_PID=$!

# Start landing page dev server
cd landing-page
npx vite --host 0.0.0.0 --port 3002 &
LANDING_PID=$!
cd ..

echo ""
echo "========================================"
echo "  BANKY is running!"
echo "========================================"
echo ""
echo "  Main App:     http://localhost:5000"
echo "  Admin Panel:  http://localhost:3001"
echo "  Landing Page: http://localhost:3002"
echo "  API:          http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

trap "kill $BACKEND_PID $SCHEDULER_PID $ADMIN_PID $FRONTEND_PID $LANDING_PID 2>/dev/null" EXIT
wait
STARTSCRIPT
    chmod +x packages/codecanyon/banky/start.sh

    # Create simple README
    cat > packages/codecanyon/banky/README.md << 'EOF'
# BANKY - Bank & Sacco Management System

Complete banking and Sacco management platform with multi-tenant support.

## Quick Install

```bash
./install.sh
```

Then edit `.env` with your database URL and run:

```bash
./start.sh
```

## Requirements

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+

## Deployment Modes

### SaaS Mode (run your own SaaS platform)
```
DEPLOYMENT_MODE=saas
NEON_API_KEY=your-neon-api-key
```
Each organization gets its own database automatically.

### Enterprise Mode (single organization)
```
DEPLOYMENT_MODE=enterprise
LICENSE_KEY=BANKY-XXX-2026-XXXXXXXX
```

## Project Structure

- `/client` - Main banking application (React)
- `/admin-client` - Platform admin panel (React)
- `/landing-page` - Marketing landing page (React)
- `/python_backend` - API server (FastAPI)

## Features

- Member & Staff Management
- Loan Management (applications, disbursement, repayments)
- Fixed Deposits & Dividends
- Teller Station & Float Management
- Accounting (double-entry bookkeeping)
- SMS Notifications
- Audit Logs
- Multi-branch support

## Production Deployment (Ubuntu 22.04/24.04)

### Step 1: Install Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

### Step 2: Setup Database

```bash
# Create database and user
sudo -u postgres psql
CREATE USER banky WITH PASSWORD 'your_secure_password';
CREATE DATABASE banky_master OWNER banky;
\q
```

### Step 3: Deploy Application

```bash
# Create app directory
sudo mkdir -p /var/www/banky
sudo chown $USER:$USER /var/www/banky

# Upload and extract files
cd /var/www/banky
unzip banky-v1.0.0.zip
cd banky

# Install dependencies
./install.sh

# Configure environment
nano .env
# Set: DATABASE_URL=postgresql://banky:your_secure_password@localhost:5432/banky_master
# Set: DEPLOYMENT_MODE=saas (or enterprise)
```

### Step 4: Build Frontend Assets

```bash
# Build main app
npx vite build

# Build admin panel
cd admin-client && npx vite build && cd ..

# Build landing page
cd landing-page && npx vite build && cd ..
```

### Step 5: Setup PM2 (Keep Apps Running)

An `ecosystem.config.js` is already included in the package. Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 6: Configure Subdomains with Nginx

Create `/etc/nginx/sites-available/banky`:

```nginx
# Main App - app.yoursite.com (static files + API proxy)
server {
    listen 80;
    server_name app.yoursite.com;
    root /var/www/banky/banky/dist/public;
    
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Admin Panel - admin.yoursite.com (static files)
server {
    listen 80;
    server_name admin.yoursite.com;
    root /var/www/banky/banky/admin-client/dist;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Landing Page - www.yoursite.com (static files)
server {
    listen 80;
    server_name www.yoursite.com yoursite.com;
    root /var/www/banky/banky/landing-page/dist;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Setup DNS

Add these A records in your domain DNS settings:
```
app.yoursite.com    →  YOUR_SERVER_IP
admin.yoursite.com  →  YOUR_SERVER_IP
www.yoursite.com    →  YOUR_SERVER_IP
```

Note: The API is proxied through /api/ on each subdomain, so no separate
api.yoursite.com subdomain is needed.

### Step 8: Enable HTTPS (Free SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yoursite.com -d admin.yoursite.com -d www.yoursite.com
```

### Step 9: Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## Quick Reference

| Service | Type | Subdomain |
|---------|------|-----------|
| Landing Page | Static (Nginx) | www.yoursite.com |
| Main App | Static (Nginx) | app.yoursite.com |
| Admin Panel | Static (Nginx) | admin.yoursite.com |
| API | PM2 (port 8000) | Proxied via /api/ on all subdomains |

### Useful Commands

```bash
# View logs
pm2 logs

# Restart all apps
pm2 restart all

# Check status
pm2 status

# Update after code changes
cd /var/www/banky/banky
git pull  # or re-upload files
npx vite build  # rebuild main app
cd admin-client && npx vite build && cd ..  # rebuild admin
cd landing-page && npx vite build && cd ..  # rebuild landing
pm2 restart all
```

## Support

For documentation and support, visit: https://banky.io/docs

## License

- Regular License: Single end-product
- Extended License: Required for SaaS usage
EOF

    # Create changelog
    cat > packages/codecanyon/banky/CHANGELOG.md << 'EOF'
# Changelog

## Version 1.0.0
- Initial release
- Core banking features
- Multi-tenant SaaS architecture
- Enterprise license support
- Complete accounting module
- Loan management system
- Fixed deposits & dividends
- Teller station with float management
EOF

    # Zip the package
    cd packages/codecanyon
    zip -r banky-v1.0.0.zip banky
    cd ../..
    
    echo ">>> CodeCanyon build complete: packages/codecanyon/"
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

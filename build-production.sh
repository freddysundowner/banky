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
# Database
DATABASE_URL=postgresql://user:password@host:5432/banky

# License Key (provided after purchase - REQUIRED)
LICENSE_KEY=

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

# Optional: Brevo (for emails)
BREVO_API_KEY=
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
    echo ""
    echo "IMPORTANT: You must add your LICENSE_KEY to .env"
    echo "           Get your key from the admin who sold you this license."
else
    echo ".env already exists"
fi

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your database URL and LICENSE_KEY"
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

    # Create README
    cat > packages/enterprise/banky/README.md << 'EOF'
# BANKY - Bank & Sacco Management System

Complete banking and Sacco management system for managing members, loans, savings, accounting, and more.

## Quick Install

```bash
./install.sh
```

Then edit `.env` with your database URL and license key, then run:

```bash
./start.sh
```

## Requirements

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+

## License Key

You need a license key to use BANKY. Add it to your `.env` file:

```
LICENSE_KEY=BANKY-XXX-2026-XXXXXXXX
```

License editions and their limits:
- **Basic** (BANKY-BAS-...): 1,000 members, 5 staff, 1 branch
- **Standard** (BANKY-STD-...): 5,000 members, 20 staff, 10 branches
- **Premium** (BANKY-PRE-...): 20,000 members, 100 staff, 50 branches
- **Enterprise** (BANKY-ENT-...): Unlimited

Contact your vendor to obtain your license key.

## Project Structure

- `/client` - Banking application frontend (React)
- `/python_backend` - API server (FastAPI)
- `/server` - Frontend build server
- `/shared` - Shared type definitions

## Features

- Member & Staff Management
- Loan Management (applications, disbursement, repayments, guarantors)
- Fixed Deposits & Dividends
- Teller Station & Float Management
- Accounting (double-entry bookkeeping, Chart of Accounts, reports)
- Transaction Management
- Multi-branch support
- SMS Notifications
- M-Pesa Integration
- HR & Payroll
- Audit Logs
- Analytics Dashboard

## Production Deployment (Ubuntu 22.04/24.04)

### Step 1: Install Prerequisites

```bash
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx & PM2
sudo apt install -y nginx
sudo npm install -g pm2
```

### Step 2: Setup Database

```bash
sudo -u postgres psql
CREATE USER banky WITH PASSWORD 'your_secure_password';
CREATE DATABASE banky OWNER banky;
\q
```

### Step 3: Deploy Application

```bash
sudo mkdir -p /var/www/banky
sudo chown $USER:$USER /var/www/banky
cd /var/www/banky

# Copy and extract the banky folder here

cd banky
./install.sh

nano .env
# Set: DATABASE_URL=postgresql://banky:your_secure_password@localhost:5432/banky
# Set: LICENSE_KEY=your-key-here
```

### Step 4: Build Frontend

```bash
npx vite build
```

### Step 5: Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 6: Configure Nginx

Create `/etc/nginx/sites-available/banky`:

```nginx
server {
    listen 80;
    server_name yoursite.com www.yoursite.com;
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
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Enable HTTPS (Free SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yoursite.com -d www.yoursite.com
```

### Step 8: Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## Useful Commands

```bash
pm2 logs          # View logs
pm2 restart all   # Restart all apps
pm2 status        # Check status
```

## Support

For documentation and support, contact your vendor.
EOF

    # Create changelog
    cat > packages/enterprise/banky/CHANGELOG.md << 'EOF'
# Changelog

## Version 1.0.0
- Initial release
- Core banking features
- Complete accounting module
- Loan management system
- Fixed deposits & dividends
- Teller station with float management
- M-Pesa integration
- SMS notifications
EOF

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
    
    # Copy only end-user source code (no admin-client, no landing-page)
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

    cat > packages/codecanyon/banky/.env.example << EOF
# Database
DATABASE_URL=postgresql://user:password@host:5432/banky

# License Key (lifetime key - all features unlocked forever)
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

# Optional: Brevo (for emails)
BREVO_API_KEY=
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
    chmod +x packages/codecanyon/banky/start.sh

    # Create ecosystem.config.js for production (PM2)
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

    # Create README
    cat > packages/codecanyon/banky/README.md << 'EOF'
# BANKY - Bank & Sacco Management System

Complete banking and Sacco management system for managing members, loans, savings, accounting, and more.

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

## License Key

Your `.env.example` already includes a lifetime license key with all features unlocked. No further activation needed.

## Project Structure

- `/client` - Banking application frontend (React)
- `/python_backend` - API server (FastAPI)
- `/server` - Frontend build server
- `/shared` - Shared type definitions

## Features

- Member & Staff Management
- Loan Management (applications, disbursement, repayments, guarantors)
- Fixed Deposits & Dividends
- Teller Station & Float Management
- Accounting (double-entry bookkeeping, Chart of Accounts, reports)
- Transaction Management
- Multi-branch support
- SMS Notifications
- M-Pesa Integration
- HR & Payroll
- Audit Logs
- Analytics Dashboard

## Production Deployment (Ubuntu 22.04/24.04)

### Step 1: Install Prerequisites

```bash
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx & PM2
sudo apt install -y nginx
sudo npm install -g pm2
```

### Step 2: Setup Database

```bash
sudo -u postgres psql
CREATE USER banky WITH PASSWORD 'your_secure_password';
CREATE DATABASE banky OWNER banky;
\q
```

### Step 3: Deploy Application

```bash
sudo mkdir -p /var/www/banky
sudo chown $USER:$USER /var/www/banky
cd /var/www/banky
unzip banky-v1.0.0.zip
cd banky

./install.sh

nano .env
# Set: DATABASE_URL=postgresql://banky:your_secure_password@localhost:5432/banky
```

### Step 4: Build Frontend

```bash
npx vite build
```

### Step 5: Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 6: Configure Nginx

Create `/etc/nginx/sites-available/banky`:

```nginx
server {
    listen 80;
    server_name yoursite.com www.yoursite.com;
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
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Enable HTTPS (Free SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yoursite.com -d www.yoursite.com
```

### Step 8: Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## Useful Commands

```bash
pm2 logs          # View logs
pm2 restart all   # Restart all apps
pm2 status        # Check status
```

## Support

For documentation and support, visit: https://banky.io/docs

## License

Regular License: Single end-product, single organization.
Extended License: Multiple organizations or SaaS usage.
EOF

    # Create changelog
    cat > packages/codecanyon/banky/CHANGELOG.md << 'EOF'
# Changelog

## Version 1.0.0
- Initial release
- Core banking features
- Complete accounting module
- Loan management system
- Fixed deposits & dividends
- Teller station with float management
- M-Pesa integration
- SMS notifications
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

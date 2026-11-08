# Multi-Cloud Active-Standby Failover Application

A production-grade, resilient **Next.js 14 (App Router) + Node.js API + PostgreSQL** reference architecture engineered for **$0.00 / month Zero-Cost Free Tier** multi-cloud deployment across **Azure App Service (Primary)** and **AWS Elastic Beanstalk (Standby)**.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Global Traffic Director   |
                      | (Cloudflare / Route 53 / TM)|
                      +--------------+--------------+
                                     |
               Health Probes: GET /api/health (every 10s)
                                     |
                +--------------------+--------------------+
                |                                         |
         [HTTP 200: Healthy]                       [Failover Standby]
                |                                         |
                v                                         v
   +-------------------------+               +-------------------------+
   |   Azure App Service     |               |  AWS Elastic Beanstalk  |
   |   PRIMARY REGION        |  Failover 503 |  SECONDARY HOT-STANDBY  |
   |   Tier: Free F1 Linux   | ------------> |  Tier: Single t3.micro  |
   |   Runtime: Node.js 20   |               |  Runtime: Node.js 20    |
   |   Cost: $0.00 / month   |               |  Cost: $0.00 / month    |
   +------------+------------+               +------------+------------+
                |                                         |
                +--------------------+--------------------+
                                     |
                                     v
                      +-----------------------------+
                      |    Shared Cloud Database    |
                      | Neon.tech / Supabase (Free) |
                      |    PostgreSQL with SSL      |
                      +-----------------------------+
```

### Zero-Cost Breakdown

| Component | Cloud Provider | Free Tier Specification | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Primary Origin** | **Azure App Service** | Free F1 Tier (Linux, 1 GB RAM, 60 CPU min/day) | **$0.00** |
| **Standby Origin** | **AWS Elastic Beanstalk** | Single-Instance Free Tier `t3.micro` (750 hrs/mo) | **$0.00** |
| **Database Layer** | **Neon / Supabase** | Serverless PostgreSQL (0.5 GB storage, SSL) | **$0.00** |
| **Failover Routing**| **Cloudflare / DNS** | Free Tier Health Monitoring / DNS Probes | **$0.00** |
| **Total** | | | **$0.00 / month** |

---

## Key Features

1. **Active-Standby Dual Cloud Configuration**:
   - `Procfile` configured with `web: npm start` for AWS Elastic Beanstalk Node.js platform compatibility.
   - `package.json` start script: `next start -p ${PORT:-8080}` adapts dynamically to Azure App Service's dynamic assigned `$PORT` and AWS Elastic Beanstalk's default port `8080`.
2. **Instant Live Outage Trigger (`/api/health`)**:
   - `GET /api/health`: Returns HTTP 200 when healthy, or HTTP 503 `{"status": "unhealthy", "reason": "Simulated primary region outage..."}` when simulated outage is toggled.
   - `POST /api/health`: Instantly flips the in-memory health flag for live interactive demonstrations of failover triggers.
3. **Resilient PostgreSQL Database Layer (`lib/db.js`)**:
   - Configured with `pg.Pool` with SSL `rejectUnauthorized: false` for cloud-hosted Neon/Supabase PostgreSQL.
   - Includes automatic table initializer `initDb()` creating `incident_logs`.
   - Seamless **in-memory fallback** store if `DATABASE_URL` is not provided locally or during CI.
4. **Dark-Mode Multi-Cloud Control Tower (`app/page.js`)**:
   - Displays real-time serving cloud badge: **Azure Primary** (Blue `#0078D4`) vs **AWS Standby** (Amber `#FF9900`).
   - Live HTTP status indicator (`200 OK` vs `503 OUTAGE`).
   - One-click "Simulate Outage" button.
   - Auto-refresh toggle polling `/api/records` every 3 seconds.
   - Form to log new incident checkpoints directly to PostgreSQL from whichever cloud origin is actively serving.
5. **Containerization**:
   - Multi-stage `Dockerfile` (`node:20-alpine`) using Next.js 14 standalone output for minimal footprint (~120MB).
6. **Dual-Cloud GitHub Actions CI/CD Pipeline**:
   - Automated testing and Docker build verification on push to `main`.
   - Gated automatic deployment jobs to Azure App Service and AWS Elastic Beanstalk.

---

## Project Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy-multicloud.yml     # Zero-Cost Dual-Cloud GitHub Actions Pipeline
├── app/
│   ├── api/
│   │   ├── health/
│   │   │   └── route.js              # Health probe (HTTP 200 / 503) & toggle trigger
│   │   └── records/
│   │       └── route.js              # Incident log CRUD with origin metadata
│   ├── globals.css                   # Tailwind CSS styling and animations
│   ├── layout.js                     # Root HTML layout and metadata
│   └── page.js                       # Multi-Cloud Control Tower Frontend
├── lib/
│   └── db.js                         # PostgreSQL pool + table init + in-memory fallback
├── public/
│   └── robots.txt
├── tests/
│   └── app.test.mjs                  # Native Node.js test suite
├── .dockerignore
├── Dockerfile                        # Multi-stage production container
├── next.config.mjs                   # Next.js 14 configuration
├── package.json
├── postcss.config.mjs
├── Procfile                          # Elastic Beanstalk process definition
├── README.md
└── tailwind.config.mjs
```

---

## Local Development & Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Tests
```bash
npm test
```
Runs Node's native test runner (`node --test tests/app.test.mjs`) verifying:
- Procfile and Dockerfile configuration
- Health API toggle (`GET 200` -> `POST toggle` -> `GET 503` -> `POST restore` -> `GET 200`)
- Records API CRUD operations
- Database layer in-memory fallback

### 3. Build Production Bundle
```bash
npm run build
```

### 4. Start Local Server
```bash
npm start
# Server listens on port 8080 (or $PORT)
```
Open [http://localhost:8080](http://localhost:8080) to view the Control Tower dashboard.

### 5. Build & Run via Docker
```bash
docker build -t multi-cloud-app:latest .
docker run -p 8080:8080 -e CLOUD_PROVIDER="LOCAL-CONTAINER" multi-cloud-app:latest
```

---

## Cloud Deployment Guide

### Azure App Service (Primary F1 Free Tier)
1. In Azure Portal, create an **App Service** plan selecting:
   - **OS**: Linux
   - **Pricing Plan**: Free F1 (1 GB memory)
   - **Runtime Stack**: Node 20 LTS
2. Download the Publish Profile from the Azure Web App overview blade.
3. In your GitHub Repository:
   - Add Secret: `AZURE_WEBAPP_PUBLISH_PROFILE` (paste XML publish profile content).
   - Add Variable: `ENABLE_AZURE_DEPLOY` = `true`.
   - Add Variable: `AZURE_WEBAPP_NAME` = your Azure Web App name.
4. Set Application Settings in Azure Portal:
   - `CLOUD_PROVIDER`: `AZURE-PRIMARY`
   - `CLOUD_REGION`: `eastus` (or your Azure region)
   - `DATABASE_URL`: `postgres://...` (your free Neon/Supabase connection string)

### AWS Elastic Beanstalk (Standby Free Tier)
1. In AWS Management Console, create an **Elastic Beanstalk Application**:
   - **Platform**: Node.js 20 running on 64-bit Amazon Linux 2023
   - **Preset**: Single instance (Free Tier eligible `t3.micro`)
2. In your GitHub Repository:
   - Add Secret: `AWS_ACCESS_KEY_ID`
   - Add Secret: `AWS_SECRET_ACCESS_KEY`
   - Add Variable: `ENABLE_AWS_DEPLOY` = `true`
   - Add Variable: `AWS_EB_APP_NAME` = your Beanstalk application name
   - Add Variable: `AWS_EB_ENV_NAME` = your Beanstalk environment name
   - Add Variable: `AWS_REGION` = `us-east-1`
   - Add Variable: `AWS_EB_ENDPOINT_URL` = your environment URL
3. Set Environment Properties in Beanstalk Configuration:
   - `CLOUD_PROVIDER`: `AWS-SECONDARY`
   - `CLOUD_REGION`: `us-east-1`
   - `DATABASE_URL`: `postgres://...` (same shared PostgreSQL database)


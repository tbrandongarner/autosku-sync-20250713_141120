# autosku-sync-20250713_141120

A Shopify embedded app that automates two-way synchronization of vendor product and inventory data (via CSV uploads or Google Sheets) with Shopify stores.

Project Description:  
https://docs.google.com/document/d/1KO9dpGW4dHP1rjfic-SjAqCldGyZibTafgqVhdVLT6g/

---

## Table of Contents

1. [Overview](#overview)  
2. [Features](#features)  
3. [Architecture](#architecture)  
4. [Installation](#installation)  
5. [Usage](#usage)  
6. [Components](#components)  
7. [Dependencies](#dependencies)  
8. [Environment Variables & Configuration](#environment-variables--configuration)  
9. [CI / Deployment](#ci--deployment)  
10. [License & Support](#license--support)  

---

## Overview

AutoSKU Sync is a Shopify embedded app that enables merchants to:

- Connect vendor feeds via CSV upload or Google Sheets.
- Define custom field mappings between feed columns and Shopify product/inventory attributes.
- Schedule regular syncs or enable real?-time updates through Shopify webhooks.
- Monitor sync status, errors, and usage in a unified dashboard.
- Manage subscription plans and usage limits via Shopify Billing API.

Built-in error handling, retry policies, notifications, and tenant isolation ensure reliable, scalable operation across multiple merchants.

---

## Features

- Shopify OAuth integration and embedded Polaris UI  
- Google Sheets connector & CSV feed processor  
- Interactive mapping wizard for field-to-attribute mapping  
- Bulk import and incremental sync modes  
- Flexible cron-style scheduling and webhook-based real?-time updates  
- Resilient retry policies, rate limiting, and circuit breakers  
- In-app and email notifications for successes and failures  
- Centralized dashboard, logs viewer, and usage analytics  
- Shopify Billing API integration for subscription enforcement  
- Multi-merchant isolation and horizontal scalability  

---

## Architecture

Server (Node.js + Express)  
? authhandler.js  
? googlesheetsconnector.js  
? csvprocessor.js  
? mappingengine.js  
? syncservice.js  
? shopifyclient.js  
? errorlogger.js  
? billingservice.js  
? webhookhandler.js  
? notificationservice.js  
? server.js  

Frontend (React + Shopify App Bridge + Polaris)  
? mappingwizard.tsx  
? dashboard.tsx  
? sidebar.tsx  
? settingspage.tsx  
? logspage.tsx  

Configuration & CI  
? shopifyconfig.toml  
? ci.yml  

Key Patterns & Integrations  
- OAuth 2.0 for Shopify & Google  
- Modular stateless services (Docker-ready)  
- Rate limiting, batching, circuit breaker  
- Tenant-scoped data model  
- Webhook-driven + scheduled sync  
- Logging, metrics, and tracing hooks  
- Subscription management via Shopify Billing API  

---

## Installation

1. Clone the repository  
   ```bash
   git clone https://github.com/your-org/autosku-sync-20250713_141120.git
   cd autosku-sync-20250713_141120
   ```

2. Install server dependencies  
   ```bash
   cd server
   npm install
   ```

3. Install frontend dependencies  
   ```bash
   cd ../frontend
   npm install
   ```

4. Create a `.env` file in the `server` directory (see [Environment Variables & Configuration](#environment-variables--configuration)).

---

## Environment Variables & Configuration

Create a `.env` in the `server` folder with:

```
PORT=3000
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory
SHOPIFY_APP_URL=https://your-app-domain.com
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-app-domain.com/auth/google/callback
SESSION_SECRET=long_random_string
DATABASE_URL=postgres://user:pass@host:port/dbname
AWS_KMS_KEY_ID=your_kms_key_id    # if using AWS KMS for secrets
```

Copy `shopifyconfig.toml` to the root and update your app manifest as needed.

---

## Usage

1. Start the development server  
   ```bash
   cd server
   npm run dev
   ```
2. Start the frontend (React)  
   ```bash
   cd frontend
   npm run start
   ```
3. In your Shopify Partner dashboard, install the app into a development store.  
4. Follow the in-app onboarding:
   - Grant Shopify permissions.
   - Connect a CSV file or link a Google Sheet.
   - Complete the Mapping Wizard.
   - Configure sync schedule or enable real-time webhooks.
5. Monitor sync status on the **Dashboard** and view detailed logs on the **Logs** page.
6. Manage subscription and usage limits in the **Settings** page.

---

## Components

Below is a list of the main components, their files, purpose, and dependencies.

- **authhandler.js**  
  Manages Shopify & Google OAuth flows, sessions.  
  Dependencies: ?  
- **googlesheetsconnector.js**  
  Fetches and polls data from Google Sheets.  
  Dependencies: authhandler  
- **csvprocessor.js**  
  Parses and normalizes CSV feeds.  
  Dependencies: ?  
- **mappingengine.js**  
  Applies merchant-defined mappings to input rows.  
  Dependencies: csvprocessor  
- **syncservice.js**  
  Orchestrates bulk and delta syncs, scheduled and webhook-triggered tasks.  
  Dependencies: mappingengine  
- **shopifyclient.js**  
  Encapsulates Shopify Admin API calls with rate-limiting & retries.  
  Dependencies: authhandler  
- **errorlogger.js**  
  Captures, categorizes, and persists errors.  
  Dependencies: ?  
- **billingservice.js**  
  Handles Shopify Billing API for plan enforcement & usage tracking.  
  Dependencies: shopifyclient  
- **webhookhandler.js**  
  Validates & handles incoming Shopify webhooks.  
  Dependencies: shopifyclient  
- **notificationservice.js**  
  Sends in-app and email notifications.  
  Dependencies: errorlogger  

Frontend UI Components (React + Polaris + App Bridge):

- **mappingwizard.tsx** ? Multi-step wizard for field mapping.  
- **dashboard.tsx** ? Overview of sync status and usage.  
- **sidebar.tsx** ? Persistent navigation.  
- **settingspage.tsx** ? Global and feed-specific settings.  
- **logspage.tsx** ? Detailed sync logs and error viewer.  

CI & Config:

- **ci.yml** ? GitHub Actions workflow for lint, test, deploy.  
- **shopifyconfig.toml** ? Shopify app manifest and extension points.

---

## Dependencies

- Node.js (>=14.x) & npm  
- Express  
- React & React DOM  
- Shopify App Bridge & Polaris  
- `@shopify/shopify-api` (Admin API client)  
- `googleapis` (Sheets API)  
- `csv-parser` or similar CSV parsing library  
- `bull` or `agenda` for job queueing  
- `winston` or `pino` for logging  
- PostgreSQL or MongoDB (for persistence)  
- Redis (for session and job queue)  
- GitHub Actions (CI)  

---

## CI / Deployment

- The `ci.yml` workflow runs linting, unit tests, and deployment validations on every push.  
- Dockerfile provided for containerizing the app (build, test, push).  
- Recommended deployment targets: AWS ECS / Fargate, Heroku, DigitalOcean App Platform.  

---

## License & Support

This project is licensed under the MIT License.  
For questions and support, please open an issue or contact the maintainer team at support@your-domain.com.
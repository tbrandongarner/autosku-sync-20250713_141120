# autosku-sync-20250713_141120

> **A Shopify embedded app that automates two-way synchronization of vendor product and inventory data via CSV uploads or Google Sheets.**

## Table of Contents

1. [Overview](#overview)  
2. [Features](#features)  
3. [Architecture](#architecture)  
4. [Installation](#installation)  
5. [Configuration](#configuration)  
6. [Usage](#usage)  
7. [Components](#components)  
8. [Dependencies](#dependencies)  
9. [CI & Deployment](#ci--deployment)  
10. [Contributing](#contributing)  
11. [License](#license)  

---

## Overview

AutoSKU Sync is a Shopify embedded application designed to:

- Connect to merchant?provided vendor feeds (CSV files or Google Sheets).  
- Guide merchants through an interactive mapping wizard to align vendor columns with Shopify product and inventory fields.  
- Perform an initial bulk import and then schedule or trigger incremental syncs via cron jobs or Shopify webhooks.  
- Handle errors gracefully with retry policies, circuit breakers, and in-app/email notifications.  
- Enforce subscription limits and billing via the Shopify Billing API.  
- Scale horizontally with stateless, Docker-ready services and comprehensive observability.

For full requirements and user flows, see our [Project Plan (UPDATED)](https://docs.google.com/document/d/1KO9dpGW4dHP1rjfic-SjAqCldGyZibTafgqVhdVLT6g/).

---

## Features

- OAuth 2.0 authentication for Shopify and Google  
- CSV parser with streaming, validation, and normalization  
- Google Sheets connector with polling and change detection  
- Template-driven, multi-step mapping wizard  
- Bulk import & delta sync (incremental updates)  
- Flexible scheduling and real-time webhook-based sync  
- Built-in rate limiting, retry, and circuit breaker patterns  
- Error logging, retry history, and in-app/email notifications  
- Tenant-scoped data isolation for multi-merchant support  
- Subscription management through Shopify Billing API  
- Dashboard, logs viewer, and usage analytics within Shopify Admin  

---

## Architecture

### Server (Node.js + Express)

- **authhandler.js**  
  Shopify & Google OAuth flows, session management, token exchange  
- **googlesheetsconnector.js**  
  Google Sheets API integration, sheet polling, data transformation  
- **csvprocessor.js**  
  CSV parsing, chunking, row validation, data normalization  
- **mappingengine.js**  
  Applies merchant-defined mapping rules to feed rows  
- **syncservice.js**  
  Orchestrates bulk imports, delta syncs, scheduled jobs, webhook triggers  
- **shopifyclient.js**  
  Shopify Admin API client (rate limiting, batching, retries, circuit breaker)  
- **errorlogger.js**  
  Centralized error capture, categorization, persistence  
- **billingservice.js**  
  Shopify Billing API integration (plan enforcement, usage tracking)  
- **webhookhandler.js**  
  Receives Shopify webhooks, validates signature, enqueues sync tasks  
- **notificationservice.js**  
  Sends in-app and email alerts for sync results and critical events  
- **server.js**  
  Express entry point, middleware registration, route wiring  

### Frontend (React + Shopify App Bridge + Polaris)

- **mappingwizard.tsx**  
  Multi-step UI for feed mapping configuration  
- **dashboard.tsx**  
  Overview of sync status, usage statistics, app health  
- **sidebar.tsx**  
  Persistent app navigation within Shopify Admin  
- **settingspage.tsx**  
  Global app settings, feed configurations, sync schedules  
- **logspage.tsx**  
  Detailed view of sync operations, errors, and retry history  

### Configuration & CI

- **shopifyconfig.toml**  
  App manifest, extension points, embedded app settings  
- **ci.yml**  
  GitHub Actions workflow for linting, testing, and deployment checks  
- **Dockerfile** (optional)  
  Containerization for horizontal scalability  

---

## Installation

### Prerequisites

- Node.js v16+ and npm or Yarn  
- A Shopify Partner account & development store  
- Google Cloud project with Sheets API enabled  
- AWS KMS or other secret storage for OAuth credentials  
- (Optional) Docker & Docker Compose for containerized deployment  

### Local Setup

1. Clone the repository  
   ```bash
   git clone https://github.com/your-org/autosku-sync-20250713_141120.git
   cd autosku-sync-20250713_141120
   ```
2. Install dependencies  
   ```bash
   npm install
   # or
   yarn install
   ```
3. Copy environment variables  
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` and set your credentials:
   ```
   SHOPIFY_API_KEY=your_api_key
   SHOPIFY_API_SECRET=your_api_secret
   SHOPIFY_APP_URL=https://your-ngrok-url.io
   GOOGLE_CLIENT_ID=?
   GOOGLE_CLIENT_SECRET=?
   JWT_SECRET=?
   AWS_KMS_KEY_ID=?
   ```
5. Populate `shopifyconfig.toml` with your app?s configuration.
6. Start the development server  
   ```bash
   npm run dev
   # or
   yarn dev
   ```

---

## Configuration

- `shopifyconfig.toml`: configure the app?s scopes, redirect URLs, and embedded settings.  
- `.env`: stores all secrets and credentials; do **not** commit to source control.  
- `ci.yml`: adjusts lint, test, and build steps for your CI environment.

---

## Usage

1. **Install the App**  
   Install your development version in a Shopify store via the Partners dashboard.  
2. **Authenticate**  
   - Complete the Shopify OAuth handshake.  
   - In the app, connect Google via OAuth.  
3. **Configure a Feed**  
   - Upload a CSV or enter a Google Sheet URL.  
   - Use the Mapping Wizard to map vendor columns to Shopify fields.  
4. **Run Initial Import**  
   The app performs a bulk import:  
   ```
   csvprocessor ? mappingengine ? shopifyclient
   ```
5. **Schedule Syncs**  
   - Set a cron schedule in **Settings**  
   - Or rely on live webhooks for near-real-time updates  
6. **Monitor & Troubleshoot**  
   - View sync status and metrics on the **Dashboard**  
   - Inspect errors and retry history on the **Logs** page  
7. **Subscription & Billing**  
   The app enforces plan limits; upgrades can be handled via the Shopify Billing UI.

---

## Components

| Component                 | File                     | Purpose                                                                |
|---------------------------|--------------------------|------------------------------------------------------------------------|
| OAuth Handler             | authhandler.js           | Manages Shopify & Google OAuth flows, token storage                    |
| Google Sheets Connector   | googlesheetsconnector.js | Fetches & polls Google Sheets feeds                                    |
| CSV Processor             | csvprocessor.js          | Parses, validates, normalizes CSV input                                |
| Mapping Engine            | mappingengine.js         | Applies merchant-defined mappings to feed rows                         |
| Sync Service              | syncservice.js           | Schedules & orchestrates bulk and delta sync jobs                      |
| Shopify Client            | shopifyclient.js         | API client with rate limiting, retries, and circuit breakers           |
| Error Logger              | errorlogger.js           | Captures, categorizes, and persists errors                             |
| Billing Service           | billingservice.js        | Interfaces with Shopify Billing API for subscription management        |
| Webhook Handler           | webhookhandler.js        | Validates & handles incoming Shopify webhooks                          |
| Notification Service      | notificationservice.js   | Sends in-app and email notifications about sync events and errors      |
| Express App Entry Point   | server.js                | Registers middleware and routes, starts the Express server             |
| Mapping Wizard (UI)       | mappingwizard.tsx        | Interactive React UI for feed-to-Shopify field mapping                  |
| Dashboard (UI)            | dashboard.tsx            | Displays overall sync health, usage, and statistics                    |
| Sidebar Navigation (UI)   | sidebar.tsx              | Persistent navigation menu in Shopify Admin                           |
| Settings Page (UI)        | settingspage.tsx         | Configure global and feed-specific settings                            |
| Logs Page (UI)            | logspage.tsx             | View, filter, and clear sync logs                                      |
| CI Workflow               | ci.yml                   | GitHub Actions pipeline for linting, testing, and deploy validations   |
| Shopify Config            | shopifyconfig.toml       | Shopify App manifest and extension point definitions                   |


---

## Dependencies

- Node.js & npm/Yarn  
- Express  
- React, React-DOM  
- Shopify App Bridge & Polaris  
- `@googleapis/sheets` (Google Sheets API)  
- `csv-parser` or similar CSV parsing library  
- `axios` or native `fetch` for HTTP requests  
- Rate limiter & circuit breaker (e.g., `bottleneck`, `opossum`)  
- Logging & monitoring (e.g., Sentry, Winston)  
- `nodemailer` (for email notifications)  
- Docker (optional for containerization)  
- GitHub Actions (for CI/CD)  

---

## CI & Deployment

- The `.github/workflows/ci.yml` defines checks for:
  - Code linting (ESLint/Prettier)  
  - Unit & integration tests  
  - Build validations  
- You can build and push a Docker image using your preferred registry:
  ```bash
  docker build -t your-org/autosku-sync:latest .
  docker push your-org/autosku-sync:latest
  ```
- In production, store secrets in AWS Secrets Manager or an equivalent vault.

---

## Contributing

1. Fork the repository.  
2. Create a feature branch: `git checkout -b feature/my-feature`.  
3. Commit your changes: `git commit -m "Add my feature"`.  
4. Push to your branch: `git push origin feature/my-feature`.  
5. Open a Pull Request and reference relevant issues.  

Please follow the existing coding style and include tests for new functionality.

---

## License

MIT ? [Your Company Name]  

---

_Thank you for using AutoSKU Sync! For questions or support, please open an issue or contact the maintainer._
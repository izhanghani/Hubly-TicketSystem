<div align="center">
  <img src="src/frontend/public/logo.svg" alt="Hubly" width="400" />
  <p><strong>Professional IT Help Desk Ticket Management System</strong></p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js" />
  <img src="https://img.shields.io/badge/License-MIT-blue" />
  <img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite" />
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite" />
</p>

---

## Features

- **Ticket Management** — Create, track, and manage support tickets with full status workflow
- **Role-Based Access** — Admin, Agent, Supervisor, User roles with granular permissions
- **SLA Tracking** — Automated SLA monitoring with business hours, escalation, and breach detection
- **Dashboard** — Real-time stats, charts, agent performance, and ticket trends
- **Workflow Automation** — Auto-route tickets to departments/agents based on rules
- **User Management** — CRUD users, bulk import, Active Directory sync
- **Notifications** — Real-time alerts via Socket.IO, email via SMTP
- **File Attachments** — Drag-and-drop uploads with validation
- **Dark Mode** — Built-in dark/light theme toggle
- **Audit Logs** — Full audit trail for every action
- **Export** — CSV export of tickets and reports
- **Customizable** — Branding, colors, ticket types, categories, departments, priorities

## Quick Start

### Windows

Double-click **`Start App.vbs`** (silent, no CMD window) or **`start.bat`** (with menu).

Or in terminal:

```bash
npm install
npm run dev
```

Open http://localhost:5173

### Linux / macOS

```bash
cp .env.example .env
npm install
npm run build
npm run prod
```

Open http://localhost:3000

### Production (Linux server)

```bash
npm install -g pm2
pm2 start src/backend/server.js --name hubly
pm2 startup
pm2 save
```

## Configuration

Copy `.env.example` to `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `JWT_SECRET` | (auto) | Auth secret key |
| `AD_ENABLED` | false | Active Directory sync |
| `SMTP_ENABLED` | false | Email notifications |

## Default Logins

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| supervisor | admin123 | Supervisor |
| it1 | admin123 | Agent |
| user1 | admin123 | User |

## Tech Stack

- **Backend:** Node.js, Express, SQLite (sql.js), Socket.IO
- **Frontend:** Vanilla JavaScript, Vite
- **Auth:** JWT, bcryptjs

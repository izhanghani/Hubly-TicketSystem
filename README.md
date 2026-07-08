# Ticket System

Professional IT Help Desk Ticket Management System with SLA tracking, role-based access, and real-time notifications.

## Features

- **Ticket Management** — Create, track, and manage support tickets with status workflow (open → in progress → resolved → closed)
- **Role-Based Access** — Admin, Agent, Supervisor, User roles with granular permissions
- **SLA Tracking** — Automated SLA monitoring with business hours, escalation, and breach detection
- **Dashboard** — Real-time stats, charts, agent performance, and ticket trends
- **Workflow Automation** — Auto-route tickets to departments/agents based on rules
- **User Management** — CRUD users, bulk import, Active Directory sync
- **Notifications** — Real-time alerts via Socket.IO, email notifications (SMTP)
- **File Attachments** — Drag-and-drop file uploads with MIME type validation
- **Dark Mode** — Built-in dark/light theme toggle
- **Audit Logs** — Full audit trail for all actions
- **Export** — CSV export of tickets
- **Customizable** — Branding, colors, ticket types, categories, departments, priority levels

## Quick Start

### Windows

Double-click **`Start App.vbs`** (no CMD window) or **`start.bat`** (with menu).

Or open terminal:

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Linux / macOS

```bash
cp .env.example .env
npm install
npm run build
npm run prod
```

Open http://localhost:3000 in your browser.

### Production Deployment (Linux)

```bash
# Install PM2
npm install -g pm2

# Start
pm2 start src/backend/server.js --name ticket-system

# Auto-start on reboot
pm2 startup
pm2 save
```

## Configuration

Copy `.env.example` to `.env` and edit:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `JWT_SECRET` | (auto) | Secret key for authentication |
| `AD_ENABLED` | false | Active Directory sync |
| `SMTP_ENABLED` | false | Email notifications |

## Default Login

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| supervisor | admin123 | Supervisor |
| user1 | admin123 | User |
| it1 | admin123 | Agent |

## Tech Stack

- **Backend:** Node.js, Express, SQLite (sql.js), Socket.IO
- **Frontend:** Vanilla JavaScript, Vite
- **Auth:** JWT, bcryptjs

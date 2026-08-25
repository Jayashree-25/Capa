# Capa

> **Team capacity planning without the spreadsheet chaos.**

Capa is a full-stack capacity planner that helps teams understand **who is working on what, how much capacity they have, and where work is piling up**.

Assign tasks with estimated hours, organize work by week or month, and instantly identify overloaded team members. Managers can easily rebalance workloads with drag-and-drop reassignment.

**Built for teams that want a clear picture of workload and capacity — without relying on spreadsheets.**

---

## ✨ Features

### 📊 Capacity & Workload

- **Per-person capacity** — configure weekly capacity for each team member.
- **Workload tracking** — assign tasks with estimated hours and organize them by week or month.
- **Capacity visualization** — instantly compare assigned hours against available capacity.
- **Overload detection** — quickly identify people who are approaching or exceeding their capacity.
- **Team & project filters** — focus on the people and work that matter.

### 🔄 Workload Management

- **Drag-and-drop reassignment** — move tasks between team members or back to unassigned.
- **Task delegation** — break larger tasks into smaller chunks and distribute them across team members.
- **Week & month views** — navigate through workloads across different time periods.
- **Project-based planning** — understand how project work contributes to team capacity.

### 🔐 Access & Collaboration

- **Role-based access control** — different capabilities for Bosses, Leads, and Engineers.
- **Organizational hierarchy** — Leads see and manage their teams through the manager hierarchy.
- **Scoped visibility** — users only see the people, projects, and tasks they're authorized to access.
- **Secure authentication** — JWT-based authentication with bcrypt password hashing.

### ⚙️ Backend & API

- **REST API** — dedicated endpoints for people, projects, tasks, users, and capacity reports.
- **PostgreSQL persistence** — relational storage with SQL migrations and foreign-key constraints.
- **Server-side authorization** — permissions and organizational scope are enforced by the backend.

### Roles & what each can see/do

| Role | Sees | Can do |
|---|---|---|
| **boss** | everyone | everything: manage people/projects, add/edit/delete tasks, reassign |
| **lead** | themselves + everyone below them in the manager tree (`managerId`) | manage people/projects, add/edit/delete tasks, reassign |
| **engineer** | only themselves and their own tasks | add tasks (assigned to self), update their own tasks; read-only report |

Scoping is enforced server-side (see `backend/lib/scope.js`) — a lead only ever sees their own subtree in people, tasks, teams, and the load report.

---

## Tech Stack

| **Frontend**            | **Backend**        | **Storage**         |
|-------------------------|--------------------|---------------------|
| React 16                | Node.js + Express 5 | PostgreSQL (via Docker) |
| Tailwind CSS v3         | REST API           | Axios (HTTP client) |
| Native HTML5 drag & drop | Helmet / CORS / rate limiting | `pg` driver + SQL migrations |

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- npm

### Installation

1. **Clone the repo**:
   ```bash
   git clone https://github.com/Jayashree-25/Capa.git
   cd capa
   ```

2. **Start PostgreSQL** (Docker):
   ```bash
   docker compose up -d        # postgres on localhost:5432
   ```

3. **Backend Setup**:
   ```bash
   cd backend
   npm install
   cp .env.example .env   # Optional — defaults work out of the box
   npm run db:setup       # apply migrations + seed demo data
   npm start              # Runs on http://localhost:3001
   ```

4. **Create the first user** (a boss, in another terminal):
   ```bash
   npm run create:user -- --email boss@example.com --password change-me-123 --role boss
   ```

5. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env   # Optional — defaults to http://localhost:3001/api
   npm start              # Runs on http://localhost:3000
   ```

6. Open **http://localhost:3000**.

---

## API Endpoints

| **Endpoint**            | **Method** | **Description** |
|-------------------------|------------|-----------------|
| `/api/auth/login`       | POST       | **Public** — login, returns a JWT (`token`) + user |
| `/api/auth/me`          | GET        | Current user (any authenticated) |
| `/api/auth/register`    | POST       | Create a user (`email`, `password`, `role`, `personId`) — **boss only** |
| `/api/auth/users`       | GET        | List users — **boss only** |
| `/api/people`           | GET/POST   | List people / add a person (`name`, `team`, `weeklyCapacity`, `managerId`) |
| `/api/people/:id`       | PUT/DELETE | Update person (incl. `managerId`) / delete (blocked while tasks are assigned) |
| `/api/teams`            | GET        | Distinct team names (for filters) |
| `/api/projects`         | GET/POST   | List projects / add a project |
| `/api/projects/:id`     | DELETE     | Delete a project (blocked while tasks reference it) |
| `/api/tasks`            | GET/POST   | List tasks (with assignee/project names) / add a task |
| `/api/tasks/:id`        | PUT/DELETE | Update a task (reassign via `assigneeId`) / delete |
| `/api/reports/load`     | GET        | **Load report** — per-person assigned vs. capacity |

> All endpoints **except** `/api/auth/login` require `Authorization: Bearer <token>`.

### Load report query params

`GET /api/reports/load?granularity=week|month&from=YYYY-MM-DD|YYYY-MM&to=...&team=Alpha&project=pr-1`

Returns per person: per-period `assignedHours` vs `capacityHours`, `utilization`, `overloaded` flag, totals for the range, and a `teamTotals` row.

- Week granularity: capacity = `weeklyCapacity` per week.
- Month granularity: capacity = `weeklyCapacity` × number of weeks (Mondays) in that month.

---

## Testing

```bash
cd backend
npm test     # 19 tests (node:test) — creates a throwaway `capa_test` database, never touches your data
```

---

## Hosting / Deployment

- **Backend**: `npm start` (dev, nodemon) or `npm run start:prod`. Set `PORT`, `FRONTEND_URL` (CORS), `DATABASE_URL`, and `JWT_SECRET` via environment variables. Apply schema with `npm run db:migrate`, seed demo data with `npm run db:seed`, and create users with `npm run create:user`. The app refuses to start in production without a `JWT_SECRET` warning — set a long random value.
- **Frontend**: `npm run build` produces static files in `frontend/build/` — serve from any static host (Netlify, Vercel, S3, nginx). Point `REACT_APP_API_URL` at your deployed backend before building.
- **Database**: the schema lives in `backend/db/migrations/` (SQL, applied by `backend/db/migrate.js`). Foreign keys enforce referential integrity (e.g., deleting a person with assigned tasks is blocked by the database).

---

## Demo Data

Seeded with 5 people, 4 projects, and 14 tasks from `backend/data/mockData.json` — including intentionally overloaded people so the overload indicators are visible immediately.

---

## Future Plans

- **Jira Integration**: sync tasks/people from Jira (`backend/services/jiraServices.js` stub).
- **Advanced Analytics**: trend lines and bottleneck prediction.
- **Role-Based Views**: tailor dashboards for PMs, Engineers, and Leadership.

---

## License

MIT.

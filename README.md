# Capa

A full-stack capacity planner for managing **who** is working on **what** — and **whether they're overloaded**.

Track team members, assign tasks with estimated hours per week, and instantly see who is over their weekly capacity (e.g. 40 hrs/week). Reassign work between people with simple drag-and-drop.

---

## Features

- **Per-person workload**: assign tasks (with estimated hours) to people, bucketed by week or month.
- **Capacity vs. assigned hours**: each person's total assigned hours is compared against their weekly capacity (40h default, configurable per person).
- **Overload indicators**: red cells + "Overloaded" badges wherever assigned hours exceed capacity (amber when ≥ 80%).
- **Filters**: by team, by project, and by time period (week or month view with prev/next navigation).
- **Drag-and-drop reassignment**: drag a task chip onto another person's row (or the Unassigned group) to move it.
- **API-driven**: full REST API for people, projects, tasks, and the load report.

---

## Tech Stack

| **Frontend**            | **Backend**        | **Storage**         |
|-------------------------|--------------------|---------------------|
| React 16                | Node.js + Express 5 | JSON file (`backend/data/mockData.json`) |
| Tailwind CSS v3         | REST API           | Axios (HTTP client) |
| Native HTML5 drag & drop | Helmet / CORS / rate limiting | — |

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

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   cp .env.example .env   # Optional — defaults work out of the box
   npm start              # Runs on http://localhost:3001
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env   # Optional — defaults to http://localhost:3001/api
   npm start              # Runs on http://localhost:3000
   ```

4. Open **http://localhost:3000**.

---

## API Endpoints

| **Endpoint**            | **Method** | **Description** |
|-------------------------|------------|-----------------|
| `/api/people`           | GET/POST   | List people / add a person (`name`, `team`, `weeklyCapacity`) |
| `/api/people/:id`       | PUT/DELETE | Update person / delete (blocked while tasks are assigned) |
| `/api/teams`            | GET        | Distinct team names (for filters) |
| `/api/projects`         | GET/POST   | List projects / add a project |
| `/api/projects/:id`     | DELETE     | Delete a project (blocked while tasks reference it) |
| `/api/tasks`            | GET/POST   | List tasks (with assignee/project names) / add a task |
| `/api/tasks/:id`        | PUT/DELETE | Update a task (reassign via `assigneeId`) / delete |
| `/api/reports/load`     | GET        | **Load report** — per-person assigned vs. capacity |

### Load report query params

`GET /api/reports/load?granularity=week|month&from=YYYY-MM-DD|YYYY-MM&to=...&team=Alpha&project=pr-1`

Returns per person: per-period `assignedHours` vs `capacityHours`, `utilization`, `overloaded` flag, totals for the range, and a `teamTotals` row.

- Week granularity: capacity = `weeklyCapacity` per week.
- Month granularity: capacity = `weeklyCapacity` × number of weeks (Mondays) in that month.

---

## Testing

```bash
cd backend
npm test     # 12 tests (node:test) — runs against a temp data file, never touches your data
```

---

## Hosting / Deployment

- **Backend**: `npm start` (dev, nodemon) or `npm run start:prod`. Set `PORT`, `FRONTEND_URL` (CORS), and optionally `DATA_FILE` via environment variables.
- **Frontend**: `npm run build` produces static files in `frontend/build/` — serve from any static host (Netlify, Vercel, S3, nginx). Point `REACT_APP_API_URL` at your deployed backend before building.
- **Note**: the JSON file store is single-instance. For multi-instance production, swap `backend/lib/store.js` for a real database.

---

## Demo Data

Seeded with 8 people across 3 teams, 5 projects, and ~30 tasks spread over recent weeks — including some intentionally overloaded people (Alice, Carol, Eva, Frank) so the overload indicators are visible immediately.

---

## Future Plans

- **Jira Integration**: sync tasks/people from Jira (`backend/services/jiraServices.js` stub).
- **Advanced Analytics**: trend lines and bottleneck prediction.
- **Role-Based Views**: tailor dashboards for PMs, Engineers, and Leadership.

---

## License

MIT.
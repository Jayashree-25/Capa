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

## 🔐 Roles & Access Control

Capa uses role-based access control (RBAC) combined with an organizational manager hierarchy.

| Role | Access | Capabilities |
|---|---|---|
| **Boss** | Full organization | Manage people, projects, tasks, users, and workloads |
| **Lead** | Their team + reporting hierarchy | Manage team members, projects, tasks, and workload assignments |
| **Engineer** | Self + assigned work | Create tasks for themselves, update their own tasks, and view their workload |

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 16, Tailwind CSS v3, Axios |
| **Backend** | Node.js, Express 5, REST API |
| **Database** | PostgreSQL, `pg`, SQL migrations |
| **Authentication** | JWT, bcrypt |
| **Security** | Helmet, CORS, rate limiting |
| **Interactions** | Native HTML5 Drag & Drop |
| **Development** | npm, Docker |

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** ≥ 18
- **npm**
- **Docker** and **Docker Compose**

### 1. Clone the repository

```bash
git clone https://github.com/Jayashree-25/Capa.git
cd Capa
   ```

### 2. **Start PostgreSQL** (Docker):

   Capa uses PostgreSQL for persistent storage.
   ```bash
   docker compose up -d        # postgres on localhost:5432
   ```
   This starts PostgreSQL on localhost:5432.

### 3. **Backend Setup**:

   Open a terminal in the backend directory:
   ```bash
   cd backend
   npm install
   cp .env.example .env   # Optional — defaults work out of the box
   npm run db:setup       # apply migrations + seed demo data
   npm start              # Runs on http://localhost:3001
   ```

### 4. **Create the first user** (a boss, in another terminal):

   Open a new terminal and run the following command from the backend directory:
   ```bash
   npm run create:user -- --email boss@example.com --password change-me-123 --role boss
   ```

### 5. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env   # Optional — defaults to http://localhost:3001/api
   npm start              # Runs on http://localhost:3000
   ```

### 6. Open **http://localhost:3000**.

---

## 🔌 API

Capa exposes a REST API for authentication, people, projects, tasks, and workload reporting.

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticate and receive a JWT |
| `GET` | `/api/auth/me` | Authenticated | Get the current user |
| `POST` | `/api/auth/register` | Boss | Create a user account |
| `GET` | `/api/auth/users` | Boss | List user accounts |

### People & Teams

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/people` | Authenticated | List people within the user's scope |
| `POST` | `/api/people` | Boss / Lead | Add a team member |
| `PUT` | `/api/people/:id` | Boss / Lead | Update a team member |
| `DELETE` | `/api/people/:id` | Boss / Lead | Remove a team member |
| `GET` | `/api/teams` | Authenticated | List available teams |

### Projects

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/projects` | Authenticated | List projects within the user's scope |
| `POST` | `/api/projects` | Boss / Lead | Create a project |
| `DELETE` | `/api/projects/:id` | Boss / Lead | Delete a project |

### Tasks

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/tasks` | Authenticated | List tasks within the user's scope |
| `POST` | `/api/tasks` | Role-based | Create a task |
| `PUT` | `/api/tasks/:id` | Role-based | Update a task or reassign work |
| `DELETE` | `/api/tasks/:id` | Role-based | Delete a task |

### Workload Reports

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/reports/load` | Authenticated | Get capacity, workload, utilization, and overload information |

> **Authentication:** All API endpoints except `POST /api/auth/login` require a valid JWT:
>
> `Authorization: Bearer <token>`

### Load Report
The load report supports weekly and monthly views:

```text
GET /api/reports/load
```
---

## 🧪 Testing

Capa includes a backend test suite using Node's built-in `node:test` framework.

Run the tests from the `backend` directory:

```bash
cd backend
npm test
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

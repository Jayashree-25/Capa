# 📊 Project Delivery and Capacity Planning Dashboard

A full-stack dashboard designed to visualize team capacity, project timelines, and roadmap trade-offs. Helps teams **align delivery dates**, **simulate reprioritizations**, and **optimize resource allocation**.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Dashboard+Screenshot) *(Replace with actual screenshot)*

---

## 🚀 Features

- **Capacity Visualization**: Compare team bandwidth against project demands.
- **Scenario Simulation**: Model the impact of adding/removing projects mid-year.
- **Roadmap Alignment**: Identify scheduling conflicts and delivery bottlenecks.
- **API-Driven**: Programmatically adjust projects and capacity via REST API.
- **Future**: Jira integration for real-time sprint data (planned).

---

## 🛠️ Tech Stack

| **Frontend**       | **Backend**        | **Tools**               |
|--------------------|--------------------|-------------------------|
| React 18           | Node.js + Express  | Axios (HTTP client)     |
| Tailwind CSS       | REST API           | Postman (Testing)       |
| Recharts (or similar) | PostgreSQL/MongoDB | Jira API (Planned)      |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 16
- PostgreSQL (or MongoDB) for backend
- npm/yarn

### Installation

1. **Clone the repo**:
   ```bash
   git clone https://github.com/your-username/project-delivery-dashboard.git
   cd project-delivery-dashboard
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Update with your DB credentials
   npm start            # Runs on http://localhost:3001
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   npm start            # Runs on http://localhost:3000
   ```

---

## 📡 API Endpoints

| **Endpoint**          | **Method** | **Description**                     |
|-----------------------|------------|-------------------------------------|
| `/api/projects`       | GET        | Fetch all projects                  |
| `/api/projects`       | POST       | Add a new project                   |
| `/api/capacity`       | GET        | Get team capacity data              |
| `/api/simulate`       | POST       | Run reprioritization simulations    |

**Test API**: Import the included `Postman_Collection.json` into Postman.

---

## 🧠 Use Cases

1. **Capacity Planning**:  
   *"When can Team A start Project X given their current workload?"*  
   → Use the dashboard to visualize availability.

2. **Reprioritization**:  
   *"What happens if we delay Project Y to onboard a high-priority client?"*  
   → Simulate changes via the API.

3. **Roadmap Conflicts**:  
   *"Are two critical projects competing for the same team in Q3?"*  
   → Check the alignment view.

---

## 📡 Future Plans

- **Jira Integration**: Sync projects/sprints automatically using Jira Cloud API.
- **Advanced Analytics**: Predictive modeling for capacity bottlenecks.
- **Role-Based Views**: Tailor dashboards for PMs, Engineers, and Leadership.

---

## 🤝 Contributing

1. Fork the project.
2. Create a branch (`git checkout -b feature/your-feature`).
3. Commit changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a PR.

---

## 📄 License

MIT. See `LICENSE` for details.

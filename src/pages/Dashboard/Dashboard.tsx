import StatCard from "../../components/dashboard/StatCard";
import "./Dashboard.css";

const Dashboard = () => {
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back to Enterprise Task Management.</p>
      </div>

      <div className="stats-grid">
        <StatCard title="Total Tasks" value={24} />
        <StatCard title="Pending" value={8} />
        <StatCard title="In Progress" value={10} />
        <StatCard title="Completed" value={6} />
      </div>

      <section className="recent-tasks">
        <h2>Recent Tasks</h2>

        <div className="task-placeholder">
          Recent tasks will appear here.
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
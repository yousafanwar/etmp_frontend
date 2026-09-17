import { useEffect, useState } from "react";
import "./Tasks.css";
import { getTasks } from "../../services/taskService";
import type { Task } from "../../interfaces/Task";

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        setError("");

        const result = await getTasks({
          pageNumber: 1,
          pageSize: 10,
        });

        setTasks(result.items);
      } catch (error) {
        setError("Failed to load tasks.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, []);

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <div>
          <h1>Tasks</h1>
          <p>Manage and track your tasks.</p>
        </div>

        <button className="create-task-button">
          + New Task
        </button>
      </div>

      <div className="tasks-content">
        {loading && <p>Loading tasks...</p>}

        {error && <p>{error}</p>}

        {!loading && !error && tasks.length === 0 && (
          <p>No tasks found.</p>
        )}

        {!loading && !error && tasks.length > 0 && (
          <div>
            {tasks.map((task) => (
              <div key={task.id}>
                <strong>{task.title}</strong>
                <span> — {task.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;
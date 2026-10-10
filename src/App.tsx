import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { tokenStore } from "./api/client";
import { AuthProvider } from "./auth/AuthContext";
import MainLayout from "./components/layout/MainLayout";
import CreateTask from "./pages/CreateTask/CreateTask";
import Dashboard from "./pages/Dashboard/Dashboard";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import Login from "./pages/Login/Login";
import ProjectDetails from "./pages/ProjectDetails/ProjectDetails";
import Projects from "./pages/Projects/Projects";
import Settings from "./pages/Settings/Settings";
import Signup from "./pages/Signup/Signup";
import TaskDetails from "./pages/TaskDetails/TaskDetails";
import Tasks from "./pages/Tasks/Tasks";
import Team from "./pages/Team/Team";

const RequireAuth = () => {
  if (!tokenStore.getAccess()) {
    return <Navigate to="/login" replace />;
  }
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
};

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route element={<RequireAuth />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetails />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/my-tasks" element={<Tasks mineOnly />} />
          <Route path="/tasks/new" element={<CreateTask />} />
          <Route path="/tasks/:id" element={<TaskDetails />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/team" element={<Team />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;

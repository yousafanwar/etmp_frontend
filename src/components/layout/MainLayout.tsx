import { Outlet } from "react-router-dom";
import Sidebar from "./SideBar";
import "./MainLayout.css";

const MainLayout = () => (
  <>
    <Sidebar />
    <main className="main-content">
      <Outlet />
    </main>
  </>
);

export default MainLayout;
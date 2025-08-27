import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../assets/styles/Layout.css";

function Layout() {
    return (
        <div className="layout-container">
            <Sidebar />
            <div className="layout-content">
                <Outlet />
            </div>
        </div>
    );
}

export default Layout;

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../assets/styles/Sidebar.css";
import ericssonLogo from "../assets/images/ericsson-logo.png"; // ← mets ton PNG ici

export default function Sidebar() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();


    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    function logout() {
        localStorage.removeItem("dcim_token");
        navigate("/login", { replace: true });
    }

    return (
        <>

            <header className="glass-topbar">
                <button
                    className="logo-btn"
                    onClick={() => setOpen(true)}
                    aria-label="Ouvrir le menu"
                >
                    <img src={ericssonLogo} alt="Ericsson" />
                </button>

                <nav className="top-links">
                    <Link to="/">Home</Link>
                    <Link to="/about">About Us</Link>
                    <button className="login-btn" onClick={logout}>Logout</button>
                </nav>
            </header>


            {open && <div className="sb-backdrop" onClick={() => setOpen(false)} />}


            <aside
                className={`mini-sidebar ${open ? "open" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
            >
                <div className="sb-header">
                    <img src={ericssonLogo} alt="" aria-hidden="true"/>
                    <button className="sb-close" onClick={() => setOpen(false)} aria-label="Fermer">×</button>
                </div>

                <ul className="sb-nav">
                    <li><Link to="/datacenters" onClick={() => setOpen(false)}>
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor" d="M3 5h18v4H3V5Zm0 6h18v4H3v-4Zm0 6h18v4H3v-4Z"/>
                        </svg>
                        Datacenters
                    </Link></li>
                    <li><Link to="/projects" onClick={() => setOpen(false)}>
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor" d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z"/>
                        </svg>
                        Projets
                    </Link></li>
                    <li><Link to="/racks" onClick={() => setOpen(false)}>
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor" d="M4 4h16v6H4V4Zm0 10h16v6H4v-6Zm2-8v2h12V6H6Zm0 10v2h12v-2H6Z"/>
                        </svg>
                        Racks
                    </Link></li>
                    <li><Link to="/connectivity" onClick={() => setOpen(false)}>
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor"
                                  d="M12 3a3 3 0 0 1 3 3v3h-2V6a1 1 0 1 0-2 0v3H9V6a3 3 0 0 1 3-3Zm7 8a3 3 0 0 1 3 3v1h-2v-1a1 1 0 1 0-2 0v1h-2v-1a3 3 0 0 1 3-3ZM2 14a3 3 0 0 1 3-3 3 3 0 0 1 3 3v1H6v-1a1 1 0 1 0-2 0v1H2v-1Zm10-1h-2v2H8v2h2v2h2v-2h2v-2h-2v-2Z"/>
                        </svg>
                        Connectivity
                    </Link></li>
                    <li><Link to="/stats" onClick={() => setOpen(false)}>
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor" d="M5 3h14v18H5V3Zm4 4H7v12h2V7Zm4 3h-2v9h2v-9Zm4-2h-2v11h2V8Z"/>
                        </svg>
                        Reports
                    </Link></li>
                    <li><Link to="/settings" onClick={() => setOpen(false)}>
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor"
                                  d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm9 4a7.9 7.9 0 0 0-.14-1.5l2.06-1.6-2-3.46-2.45.8A8.1 8.1 0 0 0 16.6 3l-.37-2.6h-4.46L11.4 3a8.1 8.1 0 0 0-1.87.74l-2.45-.8-2 3.46 2.06 1.6A7.9 7.9 0 0 0 6 12c0 .51.05 1.01.14 1.5l-2.06 1.6 2 3.46 2.45-.8c.59.32 1.22.57 1.87.74l.37 2.6h4.46l.37-2.6c.65-.17 1.28-.42 1.87-.74l2.45.8 2-3.46-2.06-1.6c.09-.49.14-.99.14-1.5Z"/>
                        </svg>
                        Settings
                    </Link></li>
                </ul>
                <footer className="sb-footer">
                    <div className="sb-ericsson">ERICSSON</div>
                    <div className="sb-copy">© 2025 Wissal &amp; Wissem</div>
                </footer>
            </aside>


        </>
    );
}

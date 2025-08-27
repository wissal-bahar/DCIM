import { Link, useNavigate } from "react-router-dom";
import "./HomePage.css";

/* chemins relatifs depuis src/features/home/HomePage.tsx */
import background from "../../assets/images/background.png";
import wissal from "../../assets/images/wissal.png";
import wissem from "../../assets/images/wissem.png";
import icMonitoring from "../../assets/images/icons/monitoring.png";
import icRacks from "../../assets/images/icons/racks.png";
import icNetwork from "../../assets/images/icons/network.png";


export default function HomePage() {
    const navigate = useNavigate();

    return (
        <div className="home">
            {/* ===== NAVBAR ===== */}
            <header className="nav">
                <div className="nav-left">
                    <a href="#top" className="brand">DCIM</a>
                </div>
                <nav className="nav-right">
                    <a href="#top">Home</a>
                    <a href="#about">About Us</a>
                    <Link to="/login" className="btn-login">Login</Link>
                </nav>
            </header>

            {/* ===== HERO ===== */}
            <section
                id="top"
                className="hero"
                style={{ backgroundImage: `url(${background})` }}
            >
                <div className="hero-overlay" />
                <div className="hero-content">
                    <h1 className="title glow">DCIM</h1>
                    <p className="subtitle">DataCenters INFRASTRUCTURE MANAGEMENT</p>
                    <p className="tagline">
                        Visualize, control and optimize your data center infrastructure with a single click.
                    </p>
                    <button className="cta" onClick={() => navigate("/login")}>
                        Start
                    </button>
                </div>
            </section>

            {/* ===== ABOUT ===== */}
            <section id="about" className="about">
                <h2 className="about-title">About the project</h2>
                <p className="about-text">
                    Our DCIM platform allows you to efficiently manage racks, components, ports, physical and logical connections, with 2D and 3D visualizations and ready-to-use reports.
                </p>

                {/* Tuiles fonctionnalités */}
                <div className="features-grid">
                    <div className="feature-card">
                        <img className="feature-icon" src={icMonitoring} alt="Monitoring"/>
                        <span>Monitoring</span>
                    </div>

                    <div className="feature-card">
                        <img className="feature-icon" src={icRacks} alt="Inventaire Racks"/>
                        <span>Rack Inventory</span>
                    </div>

                    <div className="feature-card">
                        <img className="feature-icon" src={icNetwork} alt="Connectivité"/>
                        <span>Connectivity</span>
                    </div>
                </div>


                {/* Équipe */}
                <div className="team-grid">
                    <div className="team-card">
                        <img src={wissal} alt="Wissal"/>
                        <div className="team-body">
                            <h3>BAHAR Wissal</h3>
                            <p>Computer engineer</p>
                            <blockquote>« Turning complexity into clarity, with code and design »</blockquote>
                        </div>
                    </div>

                    <div className="team-card reverse">
                        <img src={wissem} alt="Wissem" />
                        <div className="team-body">
                            <h3>BAHAR Wissem</h3>
                            <p>Computer engineer</p>
                            <blockquote>« Bringing data centers to life, from NFVi to 3D »</blockquote>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className="footer">
                <div className="ericsson">ERICSSON</div>
                <div className="copy">© 2025 Wissal &amp; Wissem. Tous droits réservés.</div>
            </footer>
        </div>
    );
}

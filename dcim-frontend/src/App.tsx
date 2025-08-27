// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import type { JSX } from "react";

// Pages publiques
import HomePage from "./features/home/HomePage";
import LoginPage from "./features/auth/LoginPage";

// Layout (sidebar + header)
import Layout from "./components/Layout";

// Datacenters
import ListeDatacenters from "./features/datacenters/ListeDatacenters";
import AfficherDatacenter from "./features/datacenters/AfficherDatacenter";
import EditeurPlan2D from "./features/datacenters/EditeurPlan2D";
import Plan2D from "./features/datacenters/Plan2D";
import Plan3D from "./features/datacenters/Plan3D";

// Racks
import ListeRacks from "./features/racks/ListeRacks";
import AfficherRack from "./features/racks/AfficherRack";
import ModifierRack from "./features/racks/ModifierRack";
import AjouterRack from "./features/racks/AjouterRack";
import NVFI3DPage from "./features/racks/NVFI3DPage";

// Composantes
import AjouterComposante from "./features/Composantes/AjouterComposante";

// Divers
import SettingsCatalogPage from "./features/settings/SettingsCatalogPage";
import StatsPage from "./features/stats/StatsPage";

// ---- Auth guard très simple
function PrivateRoute({ children }: { children: JSX.Element }) {
    const token = localStorage.getItem("dcim_token");
    return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <Router>
            <Routes>
                {/* --- Pages publiques (sans layout) --- */}
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />

                {/* --- Espace app protégé (avec Layout) --- */}
                <Route
                    element={
                        <PrivateRoute>
                            <Layout />
                        </PrivateRoute>
                    }
                >
                    {/* Datacenters */}
                    <Route path="/datacenters" element={<ListeDatacenters />} />
                    <Route path="/datacenters/:id" element={<AfficherDatacenter />} />
                    <Route path="/datacenters/:id/plan/edit" element={<EditeurPlan2D />} />
                    <Route path="/datacenters/:id/plan" element={<Plan2D />} />
                    <Route path="/datacenters/:id/plan3d" element={<Plan3D />} />

                    {/* Racks (⚠️ standardiser en /racks/...) */}
                    <Route path="/racks" element={<ListeRacks />} />
                    <Route path="/racks/:id" element={<AfficherRack />} />
                    <Route path="/racks/:id/modifier" element={<ModifierRack />} />
                    <Route path="/racks/:id/ajouter-composante" element={<AjouterComposante />} />
                    <Route path="/ajouter-rack" element={<AjouterRack />} />

                    {/* Vue 3D statique dédiée */}
                    <Route path="/racks/:id/3d" element={<NVFI3DPage />} />

                    {/* Divers */}
                    <Route path="/stats" element={<StatsPage />} />
                    <Route path="/settings" element={<SettingsCatalogPage />} />

                    {/* --- Redirections héritées (ancien singulier /rack/...) --- */}
                    <Route path="/rack/:id" element={<Navigate to="/racks/:id" replace />} />
                    <Route path="/rack/:id/modifier" element={<Navigate to="/racks/:id/modifier" replace />} />
                    <Route
                        path="/rack/:id/ajouter-composante"
                        element={<Navigate to="/racks/:id/ajouter-composante" replace />}
                    />
                </Route>

                {/* 404 simple */}
                <Route path="*" element={<div style={{ padding: 24 }}>Page non trouvée</div>} />
            </Routes>
        </Router>
    );
}

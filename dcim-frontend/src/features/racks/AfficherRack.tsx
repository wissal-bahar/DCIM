import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./AfficherRack.css";
import RackUnitsTable from "./components/RackUnitsTable";
import RackActions from "./components/RackActions";

/* ========= Types ========= */
interface Port { id: number; type: string; forme?: string; }
interface Composant {
    id: number; nom: string; type: string; modele: string; statut: string;
    color?: string; description?: string; ports: Port[]; layer?: "PHYSICAL"|"LOGICAL";
    hosts?: Composant[];
}
interface Unite {
    id: number; numero: number; composant?: Composant | null; logicals?: Composant[];
}
type RackStatus = "prototype" | "en_marche" | "en_arret";
interface RackData {
    id: number;
    nom: string;
    localisation: string;
    nbUnites: number;
    status: RackStatus;
    description?: string;

    // Position dans le plan
    posRow?: number | null;
    posCol?: number | null;
    rotationDeg?: number | null;

    // Relations
    datacenterId?: string | null;
    datacenterName?: string | null;

    rackModelId?: string | null;
    model?: { manufacturer?: string; modelRef?: string } | null;

    unites: Unite[];
    // horodatage
    createdAt?: string;
    updatedAt?: string;
}

/* ========= Helpers ========= */
const getBadgeClass = (status: string): string => {
    switch (status) {
        case "prototype": return "badge badge-prototype";
        case "en_marche": return "badge badge-actif";
        case "en_arret":  return "badge badge-inactif";
        default:          return "badge";
    }
};

export default function AfficherRack() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [rack, setRack] = useState<RackData | null>(null);
    const [loading, setLoading] = useState(true);

    // toggles colonnes (pour la vue 2D / tableau)
    const [showPhysical, setShowPhysical] = useState(true);
    const [showLogical, setShowLogical]   = useState(false);

    // panneau “infos détaillées”
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem("dcim_token") || "";
                const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

                const tryFetch = async (url: string) => {
                    const res = await fetch(url, { headers });
                    const text = await res.text(); // utile pour diagnostiquer
                    if (!res.ok) throw new Error(`HTTP ${res.status} – ${text}`);
                    let json: any;
                    try { json = JSON.parse(text); } catch {
                        throw new Error(`Réponse non-JSON: ${text.slice(0,180)}...`);
                    }
                    // accepte soit { ...rack } soit { rack: {...} }
                    return json?.rack ?? json;
                };

                // on tente /api/racks/:id puis /racks/:id (sans /api)
                const rackId = String(id).trim();
                const data =
                    await tryFetch(`/api/racks/${rackId}`).catch(() =>
                        tryFetch(`/racks/${rackId}`)
                    );

                setRack(data as RackData);
            } catch (e) {
                console.error("[AfficherRack] échec chargement rack:", e);
                setRack(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    if (loading) {
        return (
            <div className="rack-layout two-cols">
                <main className="rack-main">
                    <header className="rack-head glass-card"><div className="skeleton" style={{height:64}}/></header>
                    <section className="rack-table-wrap glass-card"><div className="skeleton" style={{height:480}}/></section>
                </main>
                <aside className="rack-side">
                    <div className="glass-card" style={{padding:16}}><div className="skeleton" style={{height:220}}/></div>
                </aside>
            </div>
        );
    }
    if (!rack) return <p>Impossible de charger ce rack.</p>;

    // actions header
    const goEdit   = () => navigate(`/racks/${id}/modifier`);
    const goDelete = () => navigate(`/racks/${id}/supprimer`); // à brancher sur confirm+DELETE

    // Vue 3D : ouvrir une page dédiée blanche /racks/:id/3d
    const go3D     = () => navigate(`/racks/${id}/3d`);
    // ou en nouvel onglet :
    // const go3D     = () => window.open(`/racks/${id}/3d`, "_blank", "noopener,noreferrer");

    return (
        <div className="rack-layout two-cols afficher-rack-page">
            {/* ===================== COLONNE GAUCHE ===================== */}
            <main className="rack-main">
                {/* En-tête (titre blanc + icônes) */}
                <header className="rack-head glass-card">
                    <div className="rack-head-row">
                        <div className="rack-head-left">
                            <h1 className="rack-title rack-title-white">
                                <span>Rack {rack.nom}</span>
                                <span className={getBadgeClass(rack.status)}>{rack.status}</span>
                            </h1>
                            <div className="rack-sub">
                                <span className="muted">Localisation :</span> <strong>{rack.localisation}</strong>
                                {rack.datacenterName ? <>{"  ·  "}<span className="muted">DC :</span> <strong>{rack.datacenterName}</strong></> : null}
                            </div>

                            {/* Onglets Vue 2D / Vue 3D */}
                            <div className="view-tabs" style={{ marginTop: 14 }}>
                                <button className="view-tab is-active">Vue 2D</button>
                                <button className="view-tab" onClick={go3D}>Vue 3D</button>
                            </div>
                        </div>

                        {/* Icônes header (info / edit / delete) */}
                        <div className="rack-head-actions">
                            <button
                                className="icon-btn"
                                aria-label="Informations rack"
                                title="Informations rack"
                                onClick={() => setShowInfo(true)}
                            >
                                <img
                                    src="/src/assets/images/info-icon.png"
                                    alt="info"
                                    className="icon-img"
                                    width={18}
                                    height={18}
                                />
                            </button>
                            <button
                                className="icon-btn"
                                aria-label="Modifier le rack"
                                title="Modifier le rack"
                                onClick={goEdit}
                            >
                                <img
                                    src="/src/assets/images/edit-icon.png"
                                    alt="edit"
                                    className="icon-img"
                                    width={18}
                                    height={18}
                                />
                            </button>
                            <button
                                className="icon-btn danger"
                                aria-label="Supprimer le rack"
                                title="Supprimer le rack"
                                onClick={goDelete}
                            >
                                <img
                                    src="/src/assets/images/trash-icon.png"
                                    alt="delete"
                                    className="icon-img"
                                    width={18}
                                    height={18}
                                />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Carte tableau : (on garde le tableau en 2D) */}
                <section className="rack-table-wrap glass-card">
                    <div className="table-inner">
                        <RackUnitsTable
                            rack={rack}
                            showPhysical={showPhysical}
                            showLogical={showLogical}
                        />
                    </div>
                </section>
            </main>

            {/* ===================== COLONNE DROITE ===================== */}
            <aside className="rack-side">
                <RackActions
                    rack={rack}
                    showPhysical={showPhysical}
                    showLogical={showLogical}
                    onTogglePhysical={() => setShowPhysical(v => !v)}
                    onToggleLogical={() => setShowLogical(v => !v)}
                    onAddComponent={() => navigate(`/rack/${id}/ajouter-composante`)}
                />

                {/* Inspecteur composante (placeholder) */}
                <div className="glass-card side-card">
                    <div className="side-title">Détails composante</div>
                    <div className="small muted">
                        Sélectionnez une unité dans le tableau pour afficher ici les informations
                        de la composante (type, modèle, ports, état…). On liera plus tard.
                    </div>
                </div>
            </aside>

            {/* ===================== PANNEAU INFOS DÉTAILLÉES ===================== */}
            {showInfo && (
                <div className="drawer" role="dialog" aria-modal="true">
                    <div className="drawer-panel glass-card">
                        <div className="drawer-head">
                            <div className="drawer-title">Informations détaillées – Rack {rack.nom}</div>
                            <button className="icon-btn" onClick={() => setShowInfo(false)} aria-label="Fermer">
                                <span className="icon-close">×</span>
                            </button>
                        </div>
                        <div className="drawer-body">
                            <div className="kv"><span className="k">Nom</span><span className="v">{rack.nom}</span></div>
                            <div className="kv"><span className="k">Status</span><span className="v">{rack.status}</span></div>
                            <div className="kv"><span className="k">Localisation</span><span className="v">{rack.localisation}</span></div>
                            <div className="kv"><span className="k">Capacité</span><span className="v">{rack.nbUnites}U</span></div>
                            <div className="kv"><span className="k">Datacenter</span><span className="v">{rack.datacenterName || "—"}</span></div>
                            <div className="kv"><span className="k">Position (plan)</span><span className="v">{rack.posRow ?? "—"} / {rack.posCol ?? "—"} (rot: {rack.rotationDeg ?? "—"}°)</span></div>
                            <div className="kv"><span className="k">Modèle rack</span><span className="v">{rack.model?.manufacturer ? `${rack.model.manufacturer} ${rack.model.modelRef ?? ""}` : "—"}</span></div>
                            <div className="kv"><span className="k">Description</span><span className="v">{rack.description || "—"}</span></div>
                            <div className="kv"><span className="k">Créé</span><span className="v">{rack.createdAt ? new Date(rack.createdAt).toLocaleString() : "—"}</span></div>
                            <div className="kv"><span className="k">Modifié</span><span className="v">{rack.updatedAt ? new Date(rack.updatedAt).toLocaleString() : "—"}</span></div>
                        </div>
                    </div>
                    <div className="drawer-backdrop" onClick={() => setShowInfo(false)} />
                </div>
            )}
        </div>
    );
}

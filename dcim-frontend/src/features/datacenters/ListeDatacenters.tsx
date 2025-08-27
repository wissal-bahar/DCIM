import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ListeDatacenters.css";
import AjouterDatacenter from "./AjouterDatacenter";
import AjouterProjet from "./AjouterProjet";


/** ===== Types ===== */
type DC = {
    id: number;
    name: string;
    client: string;      // ex: "Ericsson"
    address: string;    // ex: "Sousse, Tunisie"
    racksCount: number;
    projectsCount: number;
};
type ApiDatacenter = {
    id: number;
    name: string;
    client?: string | null;
    address?: string | null;
    racksCount?: number | null;
    projectsCount?: number | null;
    _count?: {
        racks?: number | null;
        projects?: number | null;
    } | null;
};
type Project = {
    id: number;
    name: string;
    code?: string | null;
    description: string;
    status?: string | null;

    client: string;
    datacenterId: string;
    datacenterName: string;
    address: string;        // via Datacenter.address
    racksCount: number;     // via Datacenter._count.racks

    startDate?: string | null;
    endDate?: string | null;
};

type ApiProject = {
    id: number;
    name: string;
    code?: string | null;
    description?: string | null;
    status?: string | null;
    clientOrgId?: string | null;       // tu peux le garder si tu t’en sers ailleurs
    client?: { name: string } | null;  // ← NOUVEAU: correspond à include.client
    datacenterId: string;
    startDate?: string | null;
    endDate?: string | null;
    datacenter?: {
        id: string;
        name: string;
        address?: string | null;
        _count?: { racks?: number | null } | null;
    } | null;
};

// Draft pour l'édition d'un projet (types sûrs pour le form)
/*type ProjectEditDraft = {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    status: string;              // ex: "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "DONE"
    datacenterId: string | null;
    clientOrgId: string | null;
    startDate: string | null;
    endDate: string | null;
};
*/


type Tab = "dc" | "projects";

/** ===== API helper local (évite de changer d’autres fichiers) ===== */
async function apiDelete(url: string): Promise<void> {
    const token = localStorage.getItem("dcim_token") || "";
    const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
        const j = await res.json().catch(() => undefined as unknown);
        const msg = (j && typeof j === "object" && "message" in j) ? (j as { message?: string }).message : "Erreur API";
        throw new Error(msg || "Erreur API");
    }
}

async function apiGet<T = unknown>(url: string): Promise<T> {
    const token = localStorage.getItem("dcim_token") || "";
    const res = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!res.ok) {
        let msg = "Erreur API";
        try {
            const j = await res.json();
            msg = (j as { message?: string })?.message || msg;
        } catch {
            // on ignore l'erreur de parsing JSON
        }

        throw new Error(msg);
    }

    return (await res.json()) as T;
}
function fmtDate(s?: string | null) {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function dateRangeLabel(start?: string | null, end?: string | null) {
    const a = fmtDate(start);
    const b = fmtDate(end);
    if (a && b) return `${a} → ${b}`;
    if (a && !b) return `${a} → …`;
    if (!a && b) return `… → ${b}`;
    return "Dates non renseignées";
}



export default function ListeDatacenters() {
    // Forme "UI" attendue par <AjouterProjet initial={...}>
    type ProjectInputLite = {
        name: string;
        code: string;
        description: string;
        status: "Planned" | "Active" | "Paused" | "Done";
        datacenterId: string;
        clientOrgId: string;
        startDate: string;
        endDate: string;
    };

    const navigate = useNavigate();

    // Onglets
    const [tab, setTab] = useState<Tab>("dc");

    // Filtres
    const [search, setSearch] = useState("");
    const [filterClient, setFilterClient] = useState<string>("Tous");
    const [filterLoc, setFilterLoc] = useState<string>("Toutes");

    // UI
    const [openInfoId, setOpenInfoId] = useState<number | null>(null);
    const [showAddDC, setShowAddDC] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [showAddProject, setShowAddProject] = useState(false);




    // Data
    const [data, setData] = useState<DC[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    // Datacenter en cours d'édition (ouvre la modale "Modifier")
    type DcInputLite = {
        name: string;
        client: string;
        siteName: string;
        address: string;
        visitDate: string;
        acVoltage: string;
        phases: string;
        frequency: string;
        groundingType: string;
        powerPlant: boolean;
        coolingType: string;
        coolingUnits: string;
        hasGenerator: boolean;
        hasFireExt: boolean;
        hasEmergencyLight: boolean;
        hasSecurity: boolean;
        hasToilets: boolean;
        planUrl: string;
        gridRows: string;
        gridCols: string;
        gridCellSizeMm: string;
    };
    const [editingDc, setEditingDc] =
        useState<(Partial<DcInputLite> & { id?: string }) | null>(null);


    //prjct
    const [projects, setProjects] = useState<Project[]>([]);
    const [pLoading, setPLoading] = useState(false);
    const [pError, setPError] = useState<string | null>(null);
    const [openProjectId, setOpenProjectId] = useState<number | null>(null);
    const [projectsReloadKey, setProjectsReloadKey] = useState(0);


    const [editingProject, setEditingProject] =
        useState<(Partial<ProjectInputLite> & { id?: string }) | null>(null);





    function onEditDatacenter(dc: DC) {
        setEditingDc({
            id: String(dc.id),
            name: dc.name ?? "",
            client: dc.client ?? "",
            siteName: "",             // si non dispo dans la liste, laisse vide
            address: dc.address ?? "",
            visitDate: "",

            acVoltage: "",
            phases: "",
            frequency: "",
            groundingType: "",
            powerPlant: false,

            coolingType: "",
            coolingUnits: "",

            hasGenerator: false,
            hasFireExt: false,
            hasEmergencyLight: false,
            hasSecurity: false,
            hasToilets: false,

            planUrl: "",
            gridRows: "",
            gridCols: "",
            gridCellSizeMm: "",
        });
    }


    async function onDeleteDatacenter(id: number | string) {
        if (!confirm("Supprimer ce datacenter ?")) return;
        try {
            await apiDelete(`/api/datacenters/${id}`);
            setReloadKey((k) => k + 1);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Suppression impossible");
        }
    }

    function toUiStatus(s?: string | null): ProjectInputLite["status"] {
        switch ((s ?? "").toUpperCase()) {
            case "IN_PROGRESS": return "Active";
            case "ON_HOLD":     return "Paused";
            case "DONE":        return "Done";
            default:            return "Planned";
        }
    }



    function onEditProject(p: Project) {
        setEditingProject({
            id: String(p.id),
            name: p.name ?? "",
            code: p.code ?? "",
            description: (p.description ?? "").toString(),
            status: toUiStatus(p.status),          // <-- UI enum
            datacenterId: p.datacenterId ?? "",
            clientOrgId: "",                       // si ton GET ne le renvoie pas, laisse vide
            startDate: p.startDate ?? "",
            endDate: p.endDate ?? "",
        });
    }




    async function onDeleteProject(id: number | string) {
        if (!confirm("Supprimer ce projet ?")) return;
        try {
            await apiDelete(`/api/projects/${id}`);
            setProjectsReloadKey((k) => k + 1);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Suppression impossible");
        }
    }

    /** ===== Chargement depuis l’API (sans changer le design) =====
     * Appel côté serveur avec les mêmes filtres (server-side),
     * sinon fallback en filtrage client si l’API renvoie tout.
     */
    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);

        // Construire les query params à partir des filtres existants
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (filterClient !== "Tous") params.set("client", filterClient);
        if (filterLoc !== "Toutes") params.set("location", filterLoc); // <-- ici



        // NOTE: adapte l’URL si besoin (ex. /api/datacenters/list)
        const url = `/api/datacenters${params.toString() ? `?${params.toString()}` : ""}`;

        // petit debounce pour éviter de spam l’API lors de la saisie
        const t = setTimeout(() => {
            apiGet<DC[] | { items: ApiDatacenter[] }>(url)
                .then((json) => {
                    if (!alive) return;

                    // on force un tableau d'objets ApiDatacenter
                    const itemsRaw: ApiDatacenter[] = Array.isArray(json)
                        ? (json as ApiDatacenter[])
                        : ((json.items ?? []) as ApiDatacenter[]);

                    // helper
                    function toInt(v: unknown, fallback = 0) {
                        const n = Number(v);
                        return Number.isFinite(n) ? n : fallback;
                    }

                    // normalisation → plus de NaN, plus de any
                    const normalized: DC[] = itemsRaw.map((d): DC => ({
                        id: d.id,
                        name: d.name,
                        client: d.client ?? "",
                        address: (d.address ?? "").toString().trim() || "Non renseigné",
                        racksCount: toInt(d.racksCount ?? d._count?.racks, 0),
                        projectsCount: toInt(d.projectsCount ?? d._count?.projects, 0),
                    }));

                    setData(normalized);
                })
                .catch((e: unknown) => {
                    if (!alive) return;
                    const msg = e instanceof Error ? e.message : "Erreur pendant le chargement";
                    setError(msg);
                })
                .finally(() => {
                    if (!alive) return;
                    setLoading(false);
                });
        }, 250);


        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [search, filterClient, filterLoc, reloadKey]);

    useEffect(() => {
        if (tab !== "projects") return;

        let alive = true;
        setPLoading(true);
        setPError(null);

        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (filterClient !== "Tous") params.set("client", filterClient);
        if (filterLoc !== "Toutes") params.set("address", filterLoc); // on filtre par adresse (string)

        const url = `/api/projects${params.toString() ? `?${params.toString()}` : ""}`;

        const t = setTimeout(() => {
            apiGet<ApiProject[] | { items: ApiProject[] }>(url)
                .then((json) => {
                    if (!alive) return;

                    const itemsRaw: ApiProject[] = Array.isArray(json)
                        ? (json as ApiProject[])
                        : ((json.items ?? []) as ApiProject[]);

                    const cleaned: Project[] = itemsRaw.map((p): Project => {
                        const dc = p.datacenter ?? null;
                        const racks = Number(dc?._count?.racks ?? 0);
                        return {
                            id: p.id,
                            name: p.name,
                            code: p.code ?? null,
                            description: (p.description ?? "").toString(),
                            status: p.status ?? null,

                            client: p.client?.name ?? "Ericsson",


                            datacenterId: p.datacenterId,
                            datacenterName: dc?.name ?? "Non renseigné",
                            address: (dc?.address ?? "Non renseigné").toString(),
                            racksCount: Number.isFinite(racks) ? racks : 0,

                            //
                            startDate: p.startDate ?? null,
                            endDate: p.endDate ?? null,
                        };
                    });


                    setProjects(cleaned);
                })
                .catch((e: unknown) => {
                    if (!alive) return;
                    const msg = e instanceof Error ? e.message : "Erreur lors du chargement des projets";
                    setPError(msg);
                })
                .finally(() => {
                    if (!alive) return;
                    setPLoading(false);
                });
        }, 250);

        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [tab, search, filterClient, filterLoc, projectsReloadKey]);


    /** ===== Options filtres ===== */
    const clients = useMemo(() => {
        const set = new Set<string>(["Tous"]);
        data.forEach((d) => set.add(d.client));
        return Array.from(set);
    }, [data]);


    const locations = useMemo(() => {
        const set = new Set<string>(["Toutes"]);
        data.forEach((d) => {
            if (d.address && d.address !== "Non renseigné") set.add(d.address);
        });
        return Array.from(set);
    }, [data]);



    /** ===== Filtrage client-side au cas où l’API renvoie tout ===== */
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return data.filter((d) =>
            (filterClient === "Tous" || d.client === filterClient) &&
            (filterLoc === "Toutes" || d.address === filterLoc) &&
            (q.length === 0 || d.name.toLowerCase().includes(q))
        );
    }, [data, search, filterClient, filterLoc]);



    /** ===== KPI ===== */
    const kpi = useMemo(
        () => ({
            dcs: filtered.length,
            racks: filtered.reduce((acc, d) => acc + (Number.isFinite(d.racksCount) ? d.racksCount : 0), 0),
            projects: filtered.reduce((acc, d) => acc + (Number.isFinite(d.projectsCount) ? d.projectsCount : 0), 0),
        }),
        [filtered]
    );



    // Actions
    function handleDoubleClick(dc: DC) {
        navigate(`/datacenters/${dc.id}`);
    }

    return (
        <div className="dcim-page">
            {/* Onglets centrés avec indicator */}
            <nav className="tabs-centered" role="tablist" aria-label="Sections">
                <button
                    role="tab"
                    aria-selected={tab === "dc"}
                    className={`tab-link ${tab === "dc" ? "active" : ""}`}
                    onClick={() => setTab("dc")}
                >
                    Datacenters
                </button>
                <button
                    role="tab"
                    aria-selected={tab === "projects"}
                    className={`tab-link ${tab === "projects" ? "active" : ""}`}
                    onClick={() => setTab("projects")}
                >
                    Projets
                </button>
            </nav>

            {/* Titre */}
            <header className="dcim-header">
                {tab === "dc" ? (
                    <>
                        <h1>Datacenters</h1>
                        <p className="subtitle">Choose a site to view its map and racks.</p>
                    </>
                ) : (
                    <>
                        <h1>Projets</h1>
                        <p className="subtitle">Browse projects and open the associated data center plan.</p>
                    </>
                )}
            </header>


            {/* Filtres + KPI */}
            <section className="controls">
                <div className="filters-row">
                    <div className="search">
                        <input
                            placeholder={tab === "dc" ? "Search  datacenter…" : "Search project…"}
                            aria-label={tab === "dc" ? "Search  datacenter" : "Search project"}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />

                        <svg width="18" height="18" viewBox="0 0 24 24" className="icon">
                            <path
                                fill="currentColor"
                                d="m21.53 20.47-4.66-4.66A7.49 7.49 0 1 0 9.5 17a7.45 7.45 0 0 0 4.81-1.75l4.66 4.66a.75.75 0 1 0 1.06-1.06zM4 10.5A6.5 6.5 0 1 1 10.5 17 6.51 6.51 0 0 1 4 10.5z"
                            />
                        </svg>
                    </div>

                    <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
                        {clients.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>

                    <select value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)}>
                        {locations.map((l) => (
                            <option key={l} value={l}>
                                {l}
                            </option>
                        ))}
                    </select>

                    <button
                        className="add-btn"
                        onClick={() => {
                            if (tab === "dc") {
                                setOpenInfoId(null);   // ferme le panneau info
                                setShowAddDC(true);    // ouvre l’overlay “ajouter”
                            } else {
                                setShowAddProject(true); // ouvre la modale Projet
                            }
                        }}
                    >
                        + Ajouter
                    </button>


                </div>

                <div className="kpi-row">
                    <div className="chip">
                        Datacenters : <b>{kpi.dcs}</b>
                    </div>
                    <div className="chip">
                        N° Racks : <b>{kpi.racks}</b>
                    </div>
                    <div className="chip">
                        Active Projects : <b>{kpi.projects}</b>
                    </div>
                </div>
            </section>

            {/* Contenu par onglet */}
            {tab === "dc" ? (
                <>
                    <section className="cards">
                        {loading && (
                            <article className="dc-card" title="Loading">
                                <h4 className="dc-name">Chargement…</h4>
                            </article>
                        )}
                        {!loading && error && (
                            <article className="dc-card" title="Erreur">
                                <h4 className="dc-name">Erreur : {error}</h4>
                            </article>
                        )}
                        {!loading &&
                            !error &&
                            filtered.map((dc) => {
                                return (
                                    <article
                                        key={dc.id}
                                        className="dc-card"
                                        onDoubleClick={() => handleDoubleClick(dc)}
                                        title="Double-cliquez pour ouvrir le plan"
                                    >
                                        {/* Ligne client + localisation + actions */}
                                        <div className="card-top">
                      <span className={`pill ${dc.client === "Tous" ? "pill-neutral" : "pill-client"}`}>
                        {dc.client === "Tous" ? "Multi-opérateur" : dc.client}
                      </span>

                                            <span className="loc">
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path
                              fill="currentColor"
                              d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z"
                          />
                        </svg>
                                                {dc.address || "Non renseigné"}
                      </span>

                                            <div className="fab-bar" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    className="fab-btn"
                                                    title="Modifier"
                                                    onClick={() => onEditDatacenter(dc)}
                                                >
                                                    <img src="/src/assets/images/edit-icon.png" alt="Modifier"/>
                                                </button>

                                                <button
                                                    className="fab-btn danger"
                                                    title="Supprimer"
                                                    onClick={() => onDeleteDatacenter(dc.id)}
                                                >
                                                    <img src="/src/assets/images/trash-icon.png" alt="Supprimer"/>
                                                </button>

                                                <button
                                                    className="fab-btn"
                                                    aria-label="Voir infos"
                                                    title="Voir les informations"
                                                    onClick={() => setOpenInfoId(dc.id)}
                                                >
                                                    <img src="/src/assets/images/info-icon.png" alt="Infos"/>
                                                </button>
                                                <button
                                                    className="fab-btn"
                                                    title="Plan 2D"
                                                    onClick={() => navigate(`/datacenters/${dc.id}/plan/edit`)}
                                                >
                                                    <img
                                                        src="/src/assets/images/map.png"
                                                        alt="Plan 2D"

                                                    />
                                                </button>
                                            </div>

                                        </div>

                                        {/* Titre */}
                                        <h4 className="dc-name">{dc.name}</h4>

                                        {/* Méta racks / projets */}
                                        <div className="meta">
                      <span className="meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M4 4h16v6H4V4Zm0 10h16v6H4v-6Z"/>
                        </svg>
                        Racks : <b>{dc.racksCount}</b>
                      </span>
                                            <span className="dot">•</span>
                                            <span className="meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z" />
                        </svg>
                        Projets : <b>{dc.projectsCount}</b>
                      </span>
                                        </div>
                                    </article>
                                );
                            })}
                    </section>

                    {openInfoId !== null && (
                        <>
                            <div className="drawer-backdrop" onClick={() => setOpenInfoId(null)} />
                            <aside className="info-drawer">
                                {(() => {
                                    const dc = data.find((d) => d.id === openInfoId)!;
                                    return (
                                        <>
                                            <header className="drawer-header">
                                                <h3>{dc?.name}</h3>
                                                <button className="close" onClick={() => setOpenInfoId(null)}>
                                                    ×
                                                </button>
                                            </header>

                                            {/* Corps aligné avec grid */}
                                            <div className="drawer-body">
                                                <span className="label">Client</span>
                                                <span>{dc?.client === "Tous" ? "Multi-opérateur / Non renseigné" : dc?.client}</span>

                                                <span className="label">Localisation</span>
                                                <span>
                          {dc?.address}
                        </span>

                                                <span className="label">Racks</span>
                                                <span>{dc?.racksCount}</span>

                                                <span className="label">Projets</span>
                                                <span>{dc?.projectsCount}</span>
                                            </div>

                                            <footer className="drawer-footer">
                                                <button className="primary" onClick={() => navigate(`/datacenters/${dc?.id}`)}>
                                                    Ouvrir le plan
                                                </button>
                                            </footer>
                                        </>
                                    );
                                })()}
                            </aside>
                        </>
                    )}
                </>
            ) : (
                <section className="cards">
                    {pLoading && (
                        <article className="dc-card" title="Chargement" style={{gridColumn: "1 / -1"}}>
                            <h3>Chargement…</h3>
                        </article>
                    )}

                    {!pLoading && pError && (
                        <article className="dc-card" title="Erreur" style={{gridColumn: "1 / -1"}}>
                            <h3>Erreur : {pError}</h3>
                        </article>
                    )}

                    {!pLoading && !pError && projects.length === 0 && (
                        <article className="dc-card" style={{gridColumn: "1 / -1"}}>
                            <h3>Projets</h3>
                            <p>Pas de projet correspondant aux filtres.</p>
                        </article>
                    )}

                    {!pLoading && !pError && projects.map((p) => (
                        <article
                            key={p.id}
                            className="dc-card"
                            style={{gridColumn: "1 / -1"}}   // ← carte longue, pleine largeur de la grille
                            title="Double-cliquez pour ouvrir le plan"
                            onDoubleClick={() => navigate(`/datacenters/${p.datacenterId}`)}
                        >
                            {/* Bandeau top : client + localisation + bouton info */}
                            <div className="card-top">
                                <span className="pill pill-client">{p.client}</span>

                                <span className="loc">
                            <svg width="14" height="14" viewBox="0 0 24 24">
                              <path fill="currentColor"
                                    d="M19 4h-1V2h-2v2H8V2H6v2H5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm1 14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10h16v8Zm0-10H4V7a1 1 0 0 1 1-1h1v1h2V6h8v1h2V6h1a1 1 0 0 1 1 1v2Z"/>
                            </svg>
                                    {dateRangeLabel(p.startDate, p.endDate)}
          </span>

                                <div className="fab-bar" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        className="fab-btn"
                                        title="Modifier"
                                        onClick={() => onEditProject(p)}
                                    >
                                        <img src="/src/assets/images/edit-icon.png" alt="Modifier"/>
                                    </button>

                                    <button
                                        className="fab-btn danger"
                                        title="Supprimer"
                                        onClick={() => onDeleteProject(p.id)}
                                    >
                                        <img src="/src/assets/images/trash-icon.png" alt="Supprimer"/>
                                    </button>

                                    <button
                                        className="fab-btn"
                                        aria-label="Voir infos"
                                        title="Voir les informations"
                                        onClick={() => setOpenProjectId(p.id)}
                                    >
                                        <img src="/src/assets/images/info-icon.png" alt="Infos"/>
                                    </button>
                                </div>

                            </div>

                            {/* Titre = nom du projet */}
                            <h4 className="dc-name">{p.name}</h4>

                            {/* Description courte */}
                            {p.description && <p className="subtitle">{p.description}</p>}

                            {/* Méta : datacenter + racks */}
                            <div className="meta">
          <span className="meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="currentColor" d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z"/>
            </svg>
            Datacenter : <b>{p.datacenterName}</b>
          </span>
                                <span className="dot">•</span>
                                <span className="meta-item">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="currentColor" d="M4 4h16v6H4V4Zm0 10h16v6H4v-6Z"/>
            </svg>
            Racks : <b>{p.racksCount}</b>
          </span>
                            </div>
                        </article>
                    ))}

                    {openProjectId !== null && (
                        <>
                            <div className="drawer-backdrop" onClick={() => setOpenProjectId(null)}/>
                            <aside className="info-drawer">
                                {(() => {
                                    const p = projects.find((x) => x.id === openProjectId)!;
                                    return (
                                        <>
                                            <header className="drawer-header">
                                                <h3>{p?.name}</h3>
                                                <button className="close" onClick={() => setOpenProjectId(null)}>
                                                    ×
                                                </button>
                                            </header>

                                            <div className="drawer-body">
                                                <span className="label">Client</span>
                                                <span>{p?.client}</span>

                                                <span className="label">Datacenter</span>
                                                <span>{p?.datacenterName}</span>

                                                <span className="label">Localisation</span>
                                                <span>{p?.address}</span>

                                                <span className="label">Racks</span>
                                                <span>{p?.racksCount}</span>

                                                <span className="label">Début</span>
                                                <span>{fmtDate(p?.startDate) ?? "—"}</span>

                                                <span className="label">Fin</span>
                                                <span>{fmtDate(p?.endDate) ?? "—"}</span>
                                            </div>


                                            <footer className="drawer-footer">
                                                <button className="primary"
                                                        onClick={() => navigate(`/datacenters/${p?.datacenterId}`)}>
                                                    Ouvrir le plan
                                                </button>
                                            </footer>
                                        </>
                                    );
                                })()}
                            </aside>
                        </>
                    )}
                </section>
            )}
            {/* === Overlay AJOUTER (même structure que le “i”) ===
            {showAddDC && (
                <>
                    <div className="add-drawer-backdrop" onClick={() => setShowAddDC(false)} />
                    <aside className="add-drawer">
                        <header className="add-drawer-header">
                            <h2>Ajouter un Datacenter</h2>
                            <button className="panel__close" onClick={() => setShowAddDC(false)}>×</button>
                        </header>
                        <div className="add-drawer-body">
                            <AjouterDatacenter
                                embed
                                onClose={() => setShowAddDC(false)}
                                onCreated={() => {
                                    setShowAddDC(false);
                                    setReloadKey((k) => k + 1);
                                }}
                            />
                        </div>
                    </aside>
                </>
            )}*/}
            {showAddDC && (
                <>
                    <div className="add-modal-backdrop" onClick={() => setShowAddDC(false)} />
                    <div className="add-modal">
                        <header className="add-modal-header">
                            <h2>Ajouter un Datacenter</h2>
                            <button className="panel__close" onClick={() => setShowAddDC(false)}>×</button>
                        </header>
                        <div className="add-modal-body">
                            <AjouterDatacenter
                                embed
                                onClose={() => setShowAddDC(false)}
                                onCreated={() => {
                                    setShowAddDC(false);
                                    setReloadKey((k) => k + 1);
                                }}
                            />
                        </div>
                    </div>
                </>
            )}
            {showAddProject && (
                <>
                    <div className="add-modal-backdrop" onClick={() => setShowAddProject(false)} />
                    <div className="add-modal">
                        <header className="add-modal-header">
                            <h2>Ajouter un Projet</h2>
                            <button className="panel__close" onClick={() => setShowAddProject(false)}>×</button>
                        </header>
                        <div className="add-modal-body">
                            <AjouterProjet
                                embed
                                onClose={() => setShowAddProject(false)}
                                onCreated={() => {
                                    setShowAddProject(false);
                                    setProjectsReloadKey(k => k + 1);
                                }}
                            />
                        </div>
                    </div>
                </>
            )}

            {editingProject && (
                <>
                    <div className="add-modal-backdrop" onClick={() => setEditingProject(null)} />
                    <div className="add-modal">
                        <header className="add-modal-header">
                            <h2>Modifier un Projet</h2>
                            <button className="panel__close" onClick={() => setEditingProject(null)}>×</button>
                        </header>
                        <div className="add-modal-body">
                            <AjouterProjet
                                embed
                                mode="edit"
                                initial={editingProject}   // <-- maintenant typé correctement
                                onClose={() => setEditingProject(null)}
                                onSaved={() => {
                                    setEditingProject(null);
                                    setProjectsReloadKey(k => k + 1);
                                }}
                            />
                        </div>
                    </div>
                </>
            )}
            {editingDc && (
                <>
                    <div className="add-modal-backdrop" onClick={() => setEditingDc(null)} />
                    <div className="add-modal">
                        <header className="add-modal-header">
                            <h2>Modifier un Datacenter</h2>
                            <button className="panel__close" onClick={() => setEditingDc(null)}>×</button>
                        </header>
                        <div className="add-modal-body">
                            <AjouterDatacenter
                                embed
                                mode="edit"
                                initial={editingDc}
                                onClose={() => setEditingDc(null)}
                                onSaved={() => {
                                    setEditingDc(null);
                                    setReloadKey(k => k + 1); // 🔁 recharge la liste des DC
                                }}
                            />
                        </div>
                    </div>
                </>
            )}





        </div>
    );
}

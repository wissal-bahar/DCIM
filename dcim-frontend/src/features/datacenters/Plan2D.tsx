// src/features/datacenters/Plan2D.tsx
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./EditeurPlan2D.css";

/** === Props pour sélection/surbrillance === */
type Plan2DProps = {
    selectedId?: string | number | null;
    onSelect?: (id: string | number, label?: string) => void;
};

/** ===== Types (mêmes structures que l'éditeur) ===== */
type RotMap = Record<string, number>;
type DoorLen = 1 | 2 | 3;
type OdfLen = 1 | 2;

type DcResp = {
    id: string;
    name: string;
    gridRows: number | null;
    gridCols: number | null;
    gridCellSizeMm: number | null;
    racks: Array<{
        id: number;
        nom: string;
        posRow: number;
        posCol: number;
        rotationDeg: number | null;
        localisation?: string | null;
    }>;
    siteAssets: Array<{
        id: string;
        kind: "door" | "cooling" | "odf" | string;
        label: string | null;
        posRow: number;
        posCol: number;
        spanRows: number | null;
        spanCols: number | null;
        rotationDeg: number | null;
        notes: string | null;
    }>;
};

/** ===== Helpers API/Auth ===== */
const envBase = (import.meta.env?.VITE_API_BASE_URL ?? "").toString().trim();
function resolveApiBase(): string {
    if (envBase) return envBase.replace(/\/$/, "");
    if (typeof window !== "undefined" && window.location.origin.includes("localhost:5173")) {
        return "http://localhost:3000";
    }
    return "";
}
const API_BASE = resolveApiBase();
const api = (path: string) => (API_BASE ? `${API_BASE}${path}` : path);
function getAuthHeaders(base: HeadersInit = {}): HeadersInit {
    const token =
        localStorage.getItem("authToken") ??
        localStorage.getItem("token") ??
        localStorage.getItem("jwt") ??
        localStorage.getItem("dcim_token");
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

/** ===== Helpers géométrie ===== */
const keyOf = (r: number, c: number) => `${r}:${c}`;

// PORTE
function coveredCellsForDoor(anchor: string, rot: number, len: number): string[] {
    const [rs, cs] = anchor.split(":");
    const r = parseInt(rs, 10);
    const c = parseInt(cs, 10);
    const L = Math.max(1, Math.min(3, len | 0));
    const out: string[] = [anchor];
    if (L <= 1) return out;

    if (rot === 90)       for (let i = 1; i < L; i++) out.push(keyOf(r + i, c));
    else if (rot === 270) for (let i = 1; i < L; i++) out.push(keyOf(r - i, c));
    else if (rot === 180) for (let i = 1; i < L; i++) out.push(keyOf(r, c - i));
    else                  for (let i = 1; i < L; i++) out.push(keyOf(r, c + i));
    return out;
}
function findDoorAnchorAtKey(
    k: string,
    doorSet: Set<string>,
    rotDoor: RotMap,
    lenDoor: Record<string, DoorLen>
): string | null {
    if (doorSet.has(k)) return k;
    for (const a of doorSet) {
        const rot = (rotDoor[a] ?? 0) % 360;
        const len = Math.max(1, Math.min(3, (lenDoor[a] ?? 1)));
        if (coveredCellsForDoor(a, rot, len).includes(k)) return a;
    }
    return null;
}
function doorEdgeSide(rot: number): "top" | "right" | "bottom" | "left" {
    const d = ((rot % 360) + 360) % 360;
    if (d === 0) return "right";
    if (d === 90) return "bottom";
    if (d === 180) return "left";
    return "top";
}

// RACK (2 dalles + face)
function coveredCellsForRack(anchor: string, rot: number): string[] {
    const [rs, cs] = anchor.split(":");
    const r = parseInt(rs, 10);
    const c = parseInt(cs, 10);
    if (rot === 90 || rot === 270) return [anchor, keyOf(r + 1, c)];
    return [anchor, keyOf(r, c + 1)];
}
function findRackAnchorAtKey(
    k: string,
    rackSet: Set<string>,
    rotRack: RotMap
): string | null {
    if (rackSet.has(k)) return k;
    for (const a of rackSet) {
        const rot = (rotRack[a] ?? 0) % 360;
        if (coveredCellsForRack(a, rot).includes(k)) return a;
    }
    return null;
}
function rackFaceSideForCell(
    anchor: string,
    rot: number,
    cellKey: string
): "top" | "right" | "bottom" | "left" | null {
    const [ar, ac] = anchor.split(":").map(Number);
    const [r, c] = cellKey.split(":").map(Number);
    if (rot === 0)        { if (r === ar && c === ac + 1) return "right"; }
    else if (rot === 180) { if (r === ar && c === ac)     return "left";  }
    else if (rot === 90)  { if (r === ar + 1 && c === ac) return "bottom";}
    else if (rot === 270) { if (r === ar && c === ac)     return "top";   }
    return null;
}

/** ===== Composant Lecture seule avec surbrillance + assets visibles ===== */
export default function Plan2D({ selectedId, onSelect }: Plan2DProps) {
    const { id = "" } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg] = useState<string | null>(null);

    // grille utile
    const [rows, setRows] = useState(10);
    const [cols, setCols] = useState(18);

    // placements
    const [rackSet, setRackSet] = useState<Set<string>>(new Set());
    const [doorSet, setDoorSet] = useState<Set<string>>(new Set());
    const [coolSet, setCoolSet] = useState<Set<string>>(new Set());
    const [odfSet, setOdfSet] = useState<Set<string>>(new Set());

    // meta
    const rackIdByPos = useRef<Map<string, number>>(new Map());
    const rackLabelById = useRef<Map<number, string>>(new Map());

    // rotations & longueurs
    const [rotRack, setRotRack] = useState<RotMap>({});
    const [rotDoor, setRotDoor] = useState<RotMap>({});
    const [lenDoor, setLenDoor] = useState<Record<string, DoorLen>>({});
    const [lenOdf, setLenOdf] = useState<Record<string, OdfLen>>({});

    // --------- LOAD DC ----------
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setErrMsg(null);
                setLoading(true);
                const res = await fetch(api(`/api/datacenters/${id}`), {
                    credentials: "include",
                    headers: getAuthHeaders({ Accept: "application/json" }),
                });
                if (!res.ok) {
                    setErrMsg(`GET /api/datacenters/:id → ${res.status}`);
                    setLoading(false);
                    return;
                }
                const dc: DcResp = await res.json();
                if (!mounted) return;

                const r = Math.max(1, dc.gridRows ?? 10);
                const c = Math.max(1, dc.gridCols ?? 18);
                setRows(r);
                setCols(c);

                const _rack = new Set<string>();
                const _door = new Set<string>();
                const _cool = new Set<string>();
                const _odf = new Set<string>();
                rackIdByPos.current.clear();
                rackLabelById.current.clear();

                const rr: RotMap = {};
                const rd: RotMap = {};
                const ld: Record<string, DoorLen> = {};
                const lo: Record<string, OdfLen> = {};

                for (const rk of dc.racks ?? []) {
                    const k = keyOf(rk.posRow, rk.posCol);
                    _rack.add(k);
                    rackIdByPos.current.set(k, rk.id);
                    rackLabelById.current.set(rk.id, rk.nom);
                    rr[k] = rk.rotationDeg ?? 0;
                }
                for (const a of dc.siteAssets ?? []) {
                    const k = keyOf(a.posRow, a.posCol);
                    const kind = (a.kind as string).toLowerCase();
                    const rot = (a.rotationDeg ?? 0) % 360;

                    if (kind === "door") {
                        _door.add(k);
                        rd[k] = rot;
                        const spanR = a.spanRows ?? 1;
                        const spanC = a.spanCols ?? 1;
                        const len: DoorLen =
                            (rot === 90 || rot === 270
                                ? Math.max(1, Math.min(3, spanR))
                                : Math.max(1, Math.min(3, spanC))) as DoorLen;
                        ld[k] = len;
                    } else if (kind === "cooling") {
                        _cool.add(k);
                    } else if (kind === "odf") {
                        _odf.add(k);
                        const spanR = a.spanRows ?? 1;
                        const spanC = a.spanCols ?? 1;
                        const len: OdfLen = Math.max(1, Math.min(2, Math.max(spanR, spanC))) as OdfLen;
                        lo[k] = len;
                    }
                }

                setRackSet(_rack);
                setDoorSet(_door);
                setCoolSet(_cool);
                setOdfSet(_odf);
                setRotRack(rr);
                setRotDoor(rd);
                setLenDoor(ld);
                setLenOdf(lo);
                setLoading(false);
            } catch (e) {
                console.error(e);
                setErrMsg("Erreur de chargement.");
                setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [id]);

    /** === Sélection: click simple === */
    function onCellClick(r: number, c: number) {
        const k = keyOf(r, c);
        const anchor = findRackAnchorAtKey(k, rackSet, rotRack);
        if (!anchor) return;
        const rid = rackIdByPos.current.get(anchor);
        if (rid !== undefined) {
            onSelect?.(rid, rackLabelById.current.get(rid) ?? undefined);
        }
    }

    /** Double-clic : ouvrir la page du rack */
    function onCellDoubleClick(r: number, c: number) {
        const k = keyOf(r, c);
        const anchor = findRackAnchorAtKey(k, rackSet, rotRack);
        if (!anchor) return;
        const rid = rackIdByPos.current.get(anchor);
        if (rid !== undefined) navigate(`/racks/${rid}`);
    }

    /** Ensemble des dalles à surligner si selectedId est fourni */
    const selectedCells = useMemo(() => {
        if (selectedId == null) return new Set<string>();
        const out = new Set<string>();
        for (const [anchor, rid] of rackIdByPos.current.entries()) {
            if (String(rid) === String(selectedId)) {
                const rot = (rotRack[anchor] ?? 0) % 360;
                for (const k of coveredCellsForRack(anchor, rot)) out.add(k);
                break;
            }
        }
        return out;
    }, [selectedId, rotRack, rackSet]);

    // ========= RENDER =========
    const cellPx = 42; // doit matcher --cell

    const grid = useMemo(() => {
        const out: ReactElement[] = [];

        // Couverture portes
        const doorCovered = new Set<string>();
        for (const a of doorSet) {
            const rot = (rotDoor[a] ?? 0) % 360;
            const len = Math.max(1, Math.min(3, (lenDoor[a] ?? 1)));
            for (const k of coveredCellsForDoor(a, rot, len)) doorCovered.add(k);
        }

        // Couverture racks
        const rackCovered = new Set<string>();
        for (const a of rackSet) {
            const rot = (rotRack[a] ?? 0) % 360;
            for (const k of coveredCellsForRack(a, rot)) rackCovered.add(k);
        }

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const k = keyOf(r, c);

                let type: "rack" | "door" | "cooling" | "odf" | null = null;
                if (rackCovered.has(k)) type = "rack";
                else if (doorCovered.has(k)) type = "door";
                else if (coolSet.has(k)) type = "cooling";
                else if (odfSet.has(k)) type = "odf";

                const isSelected = selectedCells.has(k);

                // Pour porte/cooling/odf : on calcule l’ancre pour rendre un marqueur propre
                const doorAnchor = type === "door"
                    ? (doorSet.has(k) ? k : findDoorAnchorAtKey(k, doorSet, rotDoor, lenDoor))
                    : null;
                const odfAnchor = type === "odf" ? (odfSet.has(k) ? k : null) : null; // ODF posé sur l’ancre
                const coolAnchor = type === "cooling" ? (coolSet.has(k) ? k : null) : null; // Cooling 1x1

                out.push(
                    <div
                        key={k}
                        className={`dc-cell ${type ? `as-${type}` : ""} ${isSelected ? "is-selected" : ""}`}
                        onClick={() => onCellClick(r, c)}
                        onDoubleClick={() => onCellDoubleClick(r, c)}
                        role="button"
                        aria-label={`cell ${r}-${c}`}
                        title={
                            type === "rack"
                                ? "Cliquer pour sélectionner, double-cliquer pour ouvrir"
                                : ""
                        }
                    >
                        <div className="dc-cell-fill">
                            {/* Porte : trait sur toutes les dalles couvertes + petit vantail sur l’ancre */}
                            {type === "door" && doorAnchor && (() => {
                                const rot = (rotDoor[doorAnchor] ?? 0) % 360;
                                const side = doorEdgeSide(rot);
                                const isAnchor = k === doorAnchor;
                                return (
                                    <>
                                        <span className={`edge edge-${side} door`} />
                                        {isAnchor && <span className={`asset door-leaf rot-${rot}`} />}
                                    </>
                                );
                            })()}
                            {/* Rack : face sur la dalle appropriée */}
                            {type === "rack" && (() => {
                                const anchor = rackSet.has(k) ? k : findRackAnchorAtKey(k, rackSet, rotRack);
                                if (!anchor) return null;
                                const side = rackFaceSideForCell(anchor, (rotRack[anchor] ?? 0) % 360, k);
                                if (!side) return null;
                                return <span className={`edge edge-${side} rack`} />;
                            })()}
                            {/* Cooling : petit bloc bleu au centre sur l’ancre */}
                            {type === "cooling" && coolAnchor && <span className="asset cooling" />}
                            {/* ODF : panneau magenta, largeur selon lenOdf sur l’ancre */}
                            {type === "odf" && odfAnchor && (
                                <span className={`asset odf len-${lenOdf[odfAnchor] ?? 1}`} />
                            )}
                        </div>
                    </div>
                );
            }
        }
        return out;
    }, [rows, cols, rackSet, doorSet, coolSet, odfSet, rotRack, rotDoor, lenDoor, lenOdf, selectedCells]);

    return (
        <div className="dc2d-page">
            <header className="dc2d-header">
                <div className="dc2d-title">
                    <span className="pill">Plan 2D (lecture seule)</span>
                    <span className="dc-id">— {id}</span>
                </div>
                <div className="dc2d-toolbar">
                    <div className="tool-group">
                        <span className="tool">Sélection</span>
                        <span style={{ opacity: 0.7, fontSize: 12, marginLeft: 8 }}>
              Click = surbrillance, Double-click = ouvrir le rack
            </span>
                    </div>
                    <button className="btn-finish" onClick={() => navigate(`/datacenters`)} title="Revenir à la liste">
                        Terminer
                    </button>
                </div>
            </header>

            <main className="dc2d-main">
                {loading ? (
                    <div className="dc2d-loading">Chargement…{errMsg ? ` (${errMsg})` : ""}</div>
                ) : (
                    <div
                        className="dc2d-grid"
                        style={{
                            gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
                            gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
                        }}
                    >
                        {grid}
                    </div>
                )}
            </main>
        </div>
    );
}

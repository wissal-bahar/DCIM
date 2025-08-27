// src/features/datacenters/EditeurPlan2D.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./EditeurPlan2D.css";
import type { ReactElement } from "react";

type Tool = "select" | "rack" | "door" | "cooling" | "odf";

type RackLight = {
    id?: number;
    nom: string;
    posRow: number;
    posCol: number;
    rotationDeg?: number;
    nbUnites?: number;
    rackModelId?: string | null;
    localisation?: string; // on y stocke le "statut"
};

type AssetLight = {
    id?: string;
    kind: "door" | "cooling" | "odf";
    label?: string | null;
    posRow: number;
    posCol: number;
    spanRows?: number;
    spanCols?: number;
    rotationDeg?: number;
    notes?: string | null;
};

type DcResp = {
    id: string;
    name: string;
    gridRows: number | null;
    gridCols: number | null;
    gridCellSizeMm: number | null;
    racks: Array<{ id: number; nom: string; posRow: number; posCol: number; rotationDeg: number | null; localisation?: string | null }>;
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

// ---------- Base API + Auth helpers ----------
const envBase = (import.meta.env?.VITE_API_BASE_URL ?? "").toString().trim();
function resolveApiBase(): string {
    if (envBase) return envBase.replace(/\/$/, "");
    if (typeof window !== "undefined" && window.location.origin.includes("localhost:5173")) {
        return "http://localhost:3000";
    }
    return "";
}
const API_BASE = resolveApiBase();

function api(path: string) {
    return API_BASE ? `${API_BASE}${path}` : path;
}
function getAuthHeaders(base: HeadersInit = {}): HeadersInit {
    const token =
        localStorage.getItem("authToken") ??
        localStorage.getItem("token") ??
        localStorage.getItem("jwt") ??
        localStorage.getItem("dcim_token");
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

const keyOf = (r: number, c: number) => `${r}:${c}`;

// ========= Helpers couverture =========

// ----- PORTE (segment 1..3 dalles) -----
function coveredCellsForDoor(anchor: string, rot: number, len: number): string[] {
    const [rs, cs] = anchor.split(":");
    const r = parseInt(rs, 10);
    const c = parseInt(cs, 10);
    const L = Math.max(1, Math.min(3, len | 0));
    const out: string[] = [anchor];
    if (L <= 1) return out;

    if (rot === 90) {        // ↓
        for (let i = 1; i < L; i++) out.push(keyOf(r + i, c));
    } else if (rot === 270) { // ↑
        for (let i = 1; i < L; i++) out.push(keyOf(r - i, c));
    } else if (rot === 180) { // ←
        for (let i = 1; i < L; i++) out.push(keyOf(r, c - i));
    } else {                  // 0 →
        for (let i = 1; i < L; i++) out.push(keyOf(r, c + i));
    }
    return out;
}
function findDoorAnchorAtKey(
    k: string,
    doorSet: Set<string>,
    rotDoor: Record<string, number>,
    lenDoor: Record<string, number>
): string | null {
    if (doorSet.has(k)) return k;
    for (const a of doorSet) {
        const rot = (rotDoor[a] ?? 0) % 360;
        const len = Math.max(1, Math.min(3, (lenDoor[a] ?? 1)));
        if (coveredCellsForDoor(a, rot, len).includes(k)) return a;
    }
    return null;
}
function doorEdgeSide(rot: number): "top"|"right"|"bottom"|"left" {
    const d = ((rot % 360) + 360) % 360;
    if (d === 0) return "right";
    if (d === 90) return "bottom";
    if (d === 180) return "left";
    return "top";
}

// ----- RACK (2 dalles + face) -----
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
    rotRack: Record<string, number>
): string | null {
    if (rackSet.has(k)) return k;
    for (const a of rackSet) {
        const rot = (rotRack[a] ?? 0) % 360;
        if (coveredCellsForRack(a, rot).includes(k)) return a;
    }
    return null;
}
function rackFaceSideForCell(anchor: string, rot: number, cellKey: string): "top"|"right"|"bottom"|"left"|null {
    const [ar, ac] = anchor.split(":").map(Number);
    const [r, c]   = cellKey.split(":").map(Number);
    if (rot === 0) {
        if (r === ar && c === ac+1) return "right";
    } else if (rot === 180) {
        if (r === ar && c === ac) return "left";
    } else if (rot === 90) {
        if (r === ar+1 && c === ac) return "bottom";
    } else if (rot === 270) {
        if (r === ar && c === ac) return "top";
    }
    return null;
}

// ----- PORTE : rotation avec ancre mobile -----
function rotateDoorWithAnchorMove(
    oldAnchor: string, oldRot: number, len: number,
    rows: number, cols: number
): { newAnchor: string; newRot: number } | null {
    const newRot = (oldRot + 90) % 360;

    const [r, c] = oldAnchor.split(":").map(Number);
    const L = Math.max(1, Math.min(3, len | 0));

    const candidates: string[] = [];
    const pushIfIn = (rr: number, cc: number) => {
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) candidates.push(keyOf(rr, cc));
    };

    if (newRot === 0) {        // →
        pushIfIn(r, c);
        pushIfIn(r, c - (L - 1));
    } else if (newRot === 90) { // ↓
        pushIfIn(r, c);
        pushIfIn(r - (L - 1), c);
    } else if (newRot === 180) { // ←
        pushIfIn(r, c + (L - 1));
        pushIfIn(r, c);
    } else { // 270 ↑
        pushIfIn(r + (L - 1), c);
        pushIfIn(r, c);
    }

    for (const cand of candidates) {
        const covered = coveredCellsForDoor(cand, newRot, L);
        let ok = true;
        for (const k of covered) {
            const [rr, cc] = k.split(":").map(Number);
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) { ok = false; break; }
        }
        if (ok) return { newAnchor: cand, newRot };
    }

    const fallback = coveredCellsForDoor(oldAnchor, newRot, L);
    for (const k of fallback) {
        const [rr, cc] = k.split(":").map(Number);
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) return null;
    }
    return { newAnchor: oldAnchor, newRot };
}

// ========= Nouveaux états pour l’édition =========
type RackStatus = "prototype" | "en marche" | "en arrêt";
type Selection =
    | { kind: "rack"; anchor: string }
    | { kind: "door"; anchor: string }
    | { kind: "cooling"; anchor: string }
    | { kind: "odf"; anchor: string }
    | null;

// ---- Helpers DELETE alignés à ton backend ----
async function deleteRackById(dcId: string, rackId: number) {
    // index.ts expose DELETE /api/racks/:id
    const res = await fetch(api(`/api/racks/${rackId}`), {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" }),
    });
    return res.ok;
}

export default function EditeurPlan2D() {
    const { id = "" } = useParams();
    const navigate = useNavigate();

    // --- UI
    const [tool, setTool] = useState<Tool>("select");
    const toolRef = useRef<Tool>(tool);
    useEffect(() => {
        toolRef.current = tool;
        isDown.current = false;
        paintOn.current = null;
    }, [tool]);

    const [saving, setSaving] = useState<"idle" | "saving" | "ok" | "err">("idle");
    const [errMsg, setErrMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // --- grille
    const [rows, setRows] = useState(10);
    const [cols, setCols] = useState(18);

    // --- placements
    const [rackSet, setRackSet] = useState<Set<string>>(new Set());
    const [doorSet, setDoorSet] = useState<Set<string>>(new Set());
    const [coolSet, setCoolSet] = useState<Set<string>>(new Set());
    const [odfSet, setOdfSet] = useState<Set<string>>(new Set());

    // ids existants
    const rackIdByPos = useRef<Map<string, number>>(new Map());
    const assetIdByPosKind = useRef<Map<string, string>>(new Map()); // `${kind}|r:c`

    // rotations
    type RotMap = Record<string, number>;
    const [rotRack, setRotRack] = useState<RotMap>({});
    const [rotDoor, setRotDoor] = useState<RotMap>({});

    // longueurs
    type DoorLen = 1 | 2 | 3;
    type OdfLen = 1 | 2;
    const [lenDoor, setLenDoor] = useState<Record<string, DoorLen>>({});
    const [lenOdf, setLenOdf] = useState<Record<string, OdfLen>>({});

    // noms & statuts des racks
    const [rackName, setRackName] = useState<Record<string, string>>({});
    const [rackStatus, setRackStatus] = useState<Record<string, RackStatus>>({});

    // sélection courante
    const [selection, setSelection] = useState<Selection>(null);

    // drag/paint
    const isDown = useRef(false);
    const paintOn = useRef<boolean | null>(null);

    // debounce
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --------- LOAD DC ---------
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
                assetIdByPosKind.current.clear();

                const rr: RotMap = {};
                const rd: RotMap = {};
                const ld: Record<string, DoorLen> = {};
                const lo: Record<string, OdfLen> = {};
                const rn: Record<string, string> = {};
                const rs: Record<string, RackStatus> = {};

                for (const rk of dc.racks ?? []) {
                    const k = keyOf(rk.posRow, rk.posCol);
                    _rack.add(k);
                    rackIdByPos.current.set(k, rk.id);
                    rr[k] = rk.rotationDeg ?? 0;
                    rn[k] = rk.nom ?? `R-${rk.posRow}-${rk.posCol}`;
                    // statut dans localisation (fallback: "prototype")
                    const st = (rk.localisation ?? "").trim().toLowerCase() as RackStatus;
                    rs[k] = (st === "en marche" || st === "en arrêt" || st === "prototype") ? st : "prototype";
                }
                for (const a of dc.siteAssets ?? []) {
                    const k = keyOf(a.posRow, a.posCol);
                    const kind = (a.kind as string).toLowerCase();
                    assetIdByPosKind.current.set(`${kind}|${k}`, a.id);
                    const rot = (a.rotationDeg ?? 0) % 360;
                    if (kind === "door") {
                        _door.add(k);
                        rd[k] = rot;
                        const spanR = a.spanRows ?? 1;
                        const spanC = a.spanCols ?? 1;
                        const len: DoorLen = (rot === 90 || rot === 270 ? Math.max(1, Math.min(3, spanR)) : Math.max(1, Math.min(3, spanC))) as DoorLen;
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
                setRackName(rn);
                setRackStatus(rs);
                setLoading(false);
            } catch (e) {
                console.error(e);
                setErrMsg("Erreur de chargement.");
                setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [id]);

    // --------- helpers paint ---------
    function toggle(setter: (s: Set<string>) => void, set: Set<string>, k: string, forceOn?: boolean | null) {
        const next = new Set(set);
        const on = forceOn ?? !set.has(k);
        if (on) next.add(k);
        else next.delete(k);
        setter(next);
    }

    function clearAllAt(r: number, c: number) {
        const k = keyOf(r, c);
        setRackSet((s) => { const n = new Set(s); n.delete(k); return n; });
        setDoorSet((s) => { const n = new Set(s); n.delete(k); return n; });
        setCoolSet((s) => { const n = new Set(s); n.delete(k); return n; });
        setOdfSet((s)  => { const n = new Set(s); n.delete(k); return n; });
        // remove rotations/lengths + noms/statuts si ancre exacte
        setRotRack(prev => { if (!(k in prev)) return prev; const { [k]:_, ...rest } = prev; return rest; });
        setRotDoor(prev => { if (!(k in prev)) return prev; const { [k]:_, ...rest } = prev; return rest; });
        setLenDoor(prev => { if (!(k in prev)) return prev; const { [k]:_, ...rest } = prev; return rest as Record<string, DoorLen>; });
        setLenOdf(prev => { if (!(k in prev)) return prev; const { [k]:_, ...rest } = prev; return rest as Record<string, OdfLen>; });
        setRackName(prev => { if (!(k in prev)) return prev; const { [k]:_, ...rest } = prev; return rest; });
        setRackStatus(prev => { if (!(k in prev)) return prev; const { [k]:_, ...rest } = prev; return rest as Record<string, RackStatus>; });
    }

    // --------- SAVE (debounced) ---------
    const queueSave = () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(doSave, 350);
    };

    async function doSave() {
        setSaving("saving");
        setErrMsg(null);

        const racks: RackLight[] = [];
        const assets: AssetLight[] = [];

        for (const pos of rackSet) {
            const [rs, cs] = pos.split(":");
            const r = parseInt(rs, 10);
            const c = parseInt(cs, 10);
            const posKey = keyOf(r, c);
            const existingId = rackIdByPos.current.get(posKey);
            const name = (rackName[posKey] ?? `R-${r}-${c}`).trim();
            const status = (rackStatus[posKey] ?? "prototype") as RackStatus;

            racks.push({
                id: existingId,
                nom: name || `R-${r}-${c}`,
                posRow: r,
                posCol: c,
                rotationDeg: rotRack[posKey] ?? 0,
                nbUnites: 42,
                rackModelId: null,
                localisation: status, // "prototype" | "en marche" | "en arrêt"
            });
        }

        const pushAssets = (kind: "door" | "cooling" | "odf", set: Set<string>) => {
            for (const pos of set) {
                const [rs, cs] = pos.split(":");
                const r = parseInt(rs, 10);
                const c = parseInt(cs, 10);
                const id = assetIdByPosKind.current.get(`${kind}|${pos}`) ?? undefined;

                let spanRows = 1;
                let spanCols = 1;
                let rotationDeg = 0;

                if (kind === "door") {
                    rotationDeg = (rotDoor[pos] ?? 0) % 360;
                    const L = (lenDoor[pos] ?? 1) as DoorLen;
                    if (rotationDeg === 90 || rotationDeg === 270) { spanRows = L; spanCols = 1; }
                    else { spanRows = 1; spanCols = L; }
                } else if (kind === "odf") {
                    const L = (lenOdf[pos] ?? 1) as OdfLen;
                    spanRows = 1; spanCols = L;
                } else {
                    spanRows = 1; spanCols = 1;
                }

                assets.push({
                    id, kind, label: null, posRow: r, posCol: c,
                    spanRows, spanCols, rotationDeg, notes: null,
                });
            }
        };
        pushAssets("door", doorSet);
        pushAssets("cooling", coolSet);
        pushAssets("odf", odfSet);

        try {
            const res = await fetch(api(`/api/datacenters/${id}/plan/bulk`), {
                method: "POST",
                credentials: "include",
                headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
                body: JSON.stringify({ replace: true, racks, assets }), // remplace les ASSETS (siteAsset.deleteMany) + upserts
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                setSaving("err");
                setErrMsg(`POST /plan/bulk → ${res.status} ${txt || ""}`);
                return;
            }

            // re-sync IDs
            const refresh = await fetch(api(`/api/datacenters/${id}`), {
                credentials: "include",
                headers: getAuthHeaders({ Accept: "application/json" }),
            });
            if (refresh.ok) {
                const dc: DcResp = await refresh.json();
                rackIdByPos.current.clear();
                assetIdByPosKind.current.clear();
                for (const rk of dc.racks ?? []) {
                    rackIdByPos.current.set(keyOf(rk.posRow, rk.posCol), rk.id);
                }
                for (const a of dc.siteAssets ?? []) {
                    const kind = (a.kind as string).toLowerCase();
                    assetIdByPosKind.current.set(`${kind}|${keyOf(a.posRow, a.posCol)}`, a.id);
                }
            }

            setSaving("ok");
            setTimeout(() => setSaving("idle"), 600);
        } catch (e) {
            console.error(e);
            setSaving("err");
            setErrMsg("Erreur réseau pendant la sauvegarde.");
        }
    }

    // ========= Interactions =========

    function onCellDown(e: React.MouseEvent, r: number, c: number) {
        isDown.current = true;
        const t = toolRef.current;
        let k = keyOf(r, c);

        // Remap sur l'ancre si on clique une case couverte
        if (t === "door" || t === "select") {
            const anchor = findDoorAnchorAtKey(k, doorSet, rotDoor, lenDoor);
            if (anchor) k = anchor;
        }
        if (t === "rack" || t === "select") {
            const anchor = findRackAnchorAtKey(k, rackSet, rotRack);
            if (anchor) k = anchor;
        }

        // === Mode SÉLECTION : panneau d’édition/suppression
        if (t === "select") {
            if (rackSet.has(k)) {
                setSelection({ kind: "rack", anchor: k });
            } else if (doorSet.has(k)) {
                setSelection({ kind: "door", anchor: k });
            } else if (coolSet.has(k)) {
                setSelection({ kind: "cooling", anchor: k });
            } else if (odfSet.has(k)) {
                setSelection({ kind: "odf", anchor: k });
            } else {
                setSelection(null);
            }
            return;
        }

        // Shift + clic : longueur door/odf
        if (e.shiftKey) {
            if (t === "door" && doorSet.has(k)) {
                setLenDoor(prev => {
                    const cur = (prev[k] ?? 1) as DoorLen;
                    const next = (cur === 1 ? 2 : cur === 2 ? 3 : 1) as DoorLen;
                    return { ...prev, [k]: next };
                });
                queueSave();
                return;
            }
            if (t === "odf" && odfSet.has(k)) {
                setLenOdf(prev => {
                    const cur = (prev[k] ?? 1) as OdfLen;
                    const next = (cur === 1 ? 2 : 1) as OdfLen;
                    return { ...prev, [k]: next };
                });
                queueSave();
                return;
            }
        }

        // Clic simple : rotation rack/door si déjà là
        if (t === "rack" && rackSet.has(k)) {
            setRotRack(prev => ({ ...prev, [k]: ((prev[k] ?? 0) + 90) % 360 }));
            queueSave();
            return;
        }
        if (t === "door" && doorSet.has(k)) {
            const oldRot = (rotDoor[k] ?? 0) % 360;
            const L = (lenDoor[k] ?? 1);
            const moved = rotateDoorWithAnchorMove(k, oldRot, L, rows, cols);
            if (moved) {
                const { newAnchor, newRot } = moved;
                if (newAnchor === k) {
                    setRotDoor(prev => ({ ...prev, [k]: newRot }));
                } else {
                    setDoorSet(prev => {
                        const n = new Set(prev); n.delete(k); n.add(newAnchor); return n;
                    });
                    setRotDoor(prev => {
                        const { [k]:_, ...rest } = prev;
                        return { ...rest, [newAnchor]: newRot };
                    });
                    setLenDoor(prev => {
                        const Lcur = prev[k] ?? 1;
                        const { [k]:_, ...rest } = prev;
                        return { ...rest, [newAnchor]: Lcur as DoorLen };
                    });
                    const oldId = assetIdByPosKind.current.get(`door|${k}`);
                    if (oldId) {
                        assetIdByPosKind.current.delete(`door|${k}`);
                        assetIdByPosKind.current.set(`door|${newAnchor}`, oldId);
                    }
                }
            }
            queueSave();
            return;
        }

        // Pose / effacement
        const already =
            (t === "rack" && rackSet.has(k)) ||
            (t === "door" && doorSet.has(k)) ||
            (t === "cooling" && coolSet.has(k)) ||
            (t === "odf" && odfSet.has(k));
        paintOn.current = !already;

        if (t === "rack") {
            // empêcher la création si la couverture chevauche un rack existant
            const desiredRot = 0; // par défaut à la pose
            const desiredCovered = coveredCellsForRack(k, desiredRot);
            const rackCovered = new Set<string>();
            for (const a of rackSet) {
                const rot = (rotRack[a] ?? 0) % 360;
                for (const cell of coveredCellsForRack(a, rot)) rackCovered.add(cell);
            }
            const collision = desiredCovered.some(cell => rackCovered.has(cell));
            if (collision) {
                const anchor = findRackAnchorAtKey(k, rackSet, rotRack);
                if (anchor && rackSet.has(anchor)) {
                    // clic sur 2e dalle d’un rack existant -> déjà géré plus haut
                }
                return; // annule la pose
            }
            if (!rackSet.has(k)) {
                setRotRack(prev => ({ ...prev, [k]: 0 }));
                setRackName(prev => ({ ...prev, [k]: `R-${r}-${c}` }));
                setRackStatus(prev => ({ ...prev, [k]: "prototype" }));
            }
            toggle(setRackSet, rackSet, k, paintOn.current);
            queueSave();
            return;
        }

        if (t === "door") {
            if (!doorSet.has(k)) {
                setRotDoor(prev => ({ ...prev, [k]: 0 }));
                setLenDoor(prev => ({ ...prev, [k]: 1 }));
            }
            toggle(setDoorSet, doorSet, k, paintOn.current);
            queueSave();
            return;
        }

        if (t === "cooling") {
            toggle(setCoolSet, coolSet, k, paintOn.current);
            queueSave();
            return;
        }

        if (t === "odf") {
            if (!odfSet.has(k)) setLenOdf(prev => ({ ...prev, [k]: 1 }));
            toggle(setOdfSet, odfSet, k, paintOn.current);
            queueSave();
            return;
        }
    }

    function onCellEnter(r: number, c: number) {
        if (!isDown.current) return;
        const t = toolRef.current;
        const k = keyOf(r, c);
        if (t === "select") return; // pas de paint en mode sélection
        else if (t === "rack") toggle(setRackSet, rackSet, k, paintOn.current);
        else if (t === "door") toggle(setDoorSet, doorSet, k, paintOn.current);
        else if (t === "cooling") toggle(setCoolSet, coolSet, k, paintOn.current);
        else if (t === "odf") toggle(setOdfSet, odfSet, k, paintOn.current);
    }

    function onUp() {
        isDown.current = false;
        paintOn.current = null;
        queueSave();
    }
    useEffect(() => {
        const handler = () => onUp();
        window.addEventListener("mouseup", handler);
        window.addEventListener("mouseleave", handler);
        return () => {
            window.removeEventListener("mouseup", handler);
            window.removeEventListener("mouseleave", handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ========= RENDER =========
    const cellPx = 42; // doit matcher --cell dans le CSS

    const grid = useMemo(() => {
        const out: ReactElement[] = [];

        // Couverture portes (toutes les dalles couvertes)
        const doorCovered = new Set<string>();
        for (const a of doorSet) {
            const rot = (rotDoor[a] ?? 0) % 360;
            const len = Math.max(1, Math.min(3, (lenDoor[a] ?? 1)));
            for (const k of coveredCellsForDoor(a, rot, len)) doorCovered.add(k);
        }

        // Couverture racks (2 dalles)
        const rackCovered = new Set<string>();
        for (const a of rackSet) {
            const rot = (rotRack[a] ?? 0) % 360;
            for (const k of coveredCellsForRack(a, rot)) rackCovered.add(k);
        }

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const k = keyOf(r, c);

                let type: Tool | null = null;
                if (rackCovered.has(k)) type = "rack";
                else if (doorCovered.has(k)) type = "door";
                else if (coolSet.has(k)) type = "cooling";
                else if (odfSet.has(k)) type = "odf";

                out.push(
                    <div
                        key={k}
                        className={`dc-cell ${type ? `as-${type}` : ""}`}
                        onMouseDown={(e) => onCellDown(e, r, c)}
                        onMouseEnter={() => onCellEnter(r, c)}
                        role="button"
                        aria-label={`cell ${r}-${c}`}
                    >
                        <div className="dc-cell-fill">
                            {/* Porte = bordure (edge) sur chaque dalle couverte */}
                            {type === "door" && (() => {
                                const anchor = doorSet.has(k) ? k : findDoorAnchorAtKey(k, doorSet, rotDoor, lenDoor);
                                if (!anchor) return null;
                                const rot = (rotDoor[anchor] ?? 0) % 360;
                                const side = doorEdgeSide(rot);
                                return <span className={`edge edge-${side} door`} />;
                            })()}
                            {/* Rack = face (edge) sur la bonne dalle/côté */}
                            {type === "rack" && (() => {
                                const anchor = rackSet.has(k) ? k : findRackAnchorAtKey(k, rackSet, rotRack);
                                if (!anchor) return null;
                                const side = rackFaceSideForCell(anchor, (rotRack[anchor] ?? 0) % 360, k);
                                if (!side) return null;
                                return <span className={`edge edge-${side} rack`} />;
                            })()}
                        </div>
                    </div>
                );
            }
        }
        return out;
    }, [rows, cols, rackSet, doorSet, coolSet, odfSet, rotRack, rotDoor, lenDoor]);

    // === Panneau d’édition / suppression (mode sélection) ===
    const selIsRack = selection?.kind === "rack";
    const selAnchor = selection?.anchor ?? null;
    const selectedRackName = selIsRack && selAnchor ? (rackName[selAnchor] ?? "") : "";
    const selectedRackStatus = (selIsRack && selAnchor ? (rackStatus[selAnchor] ?? "prototype") : "prototype") as RackStatus;

    function closePanel() { setSelection(null); }

    function saveRackEdits() {
        if (!selIsRack || !selAnchor) return;
        const name = (document.getElementById("rack-name-input") as HTMLInputElement | null)?.value ?? "";
        const status = (document.getElementById("rack-status-select") as HTMLSelectElement | null)?.value as RackStatus;
        setRackName(prev => ({ ...prev, [selAnchor]: name.trim() || prev[selAnchor] || "" }));
        setRackStatus(prev => ({ ...prev, [selAnchor]: status }));
        queueSave();
    }

    async function deleteSelected() {
        if (!selection) return;
        const a = selection.anchor;

        // 1) backend DELETE si rack (route dispo dans ton index backend)
        try {
            if (selection.kind === "rack") {
                const rid = rackIdByPos.current.get(a);
                if (rid !== undefined) {
                    const ok = await deleteRackById(id, rid);
                    if (!ok) console.warn("DELETE rack failed (backend). Je continue côté UI.");
                }
            }
            // NOTE: pour assets (door/cooling/odf), pas de route DELETE dédiée.
            // On compte sur bulk {replace:true} qui purge les assets côté backend.
        } catch (err) {
            console.error("DELETE call error:", err);
        }

        // 2) nettoyage UI
        if (selection.kind === "rack") {
            setRackSet(prev => { const n = new Set(prev); n.delete(a); return n; });
            setRotRack(prev => { const { [a]:_, ...rest } = prev; return rest; });
            setRackName(prev => { const { [a]:_, ...rest } = prev; return rest; });
            setRackStatus(prev => { const { [a]:_, ...rest } = prev; return rest as Record<string, RackStatus>; });
            rackIdByPos.current.delete(a);
        } else if (selection.kind === "door") {
            setDoorSet(prev => { const n = new Set(prev); n.delete(a); return n; });
            setRotDoor(prev => { const { [a]:_, ...rest } = prev; return rest; });
            setLenDoor(prev => { const { [a]:_, ...rest } = prev; return rest as Record<string, DoorLen>; });
            assetIdByPosKind.current.delete(`door|${a}`);
        } else if (selection.kind === "cooling") {
            setCoolSet(prev => { const n = new Set(prev); n.delete(a); return n; });
            assetIdByPosKind.current.delete(`cooling|${a}`);
        } else if (selection.kind === "odf") {
            setOdfSet(prev => { const n = new Set(prev); n.delete(a); return n; });
            setLenOdf(prev => { const { [a]:_, ...rest } = prev; return rest as Record<string, OdfLen>; });
            assetIdByPosKind.current.delete(`odf|${a}`);
        }

        setSelection(null);
        queueSave(); // déclenche le bulk (replace:true) pour refléter l’état assets
    }

    return (
        <div className="dc2d-page">
            <header className="dc2d-header">
                <div className="dc2d-title">
                    <span className="pill">Éditeur du plan</span>
                    <span className="dc-id">— {id}</span>
                </div>

                <div className="dc2d-toolbar">
                    <div className="tool-group">
                        <span className="tool-label">Outil :</span>
                        <button className={`tool ${tool === "select" ? "active" : ""}`} onClick={() => setTool("select")}>Sélection</button>
                        <button className={`tool ${tool === "rack" ? "active" : ""}`} onClick={() => setTool("rack")}><span className="dot dot-rack" />Rack</button>
                        <button className={`tool ${tool === "door" ? "active" : ""}`} onClick={() => setTool("door")}><span className="dot dot-door" />Porte</button>
                        <button className={`tool ${tool === "cooling" ? "active" : ""}`} onClick={() => setTool("cooling")}><span className="dot dot-cooling" />Cooling</button>
                        <button className={`tool ${tool === "odf" ? "active" : ""}`} onClick={() => setTool("odf")}><span className="dot dot-odf" />ODF</button>
                    </div>
                    <button className="btn-finish" onClick={() => navigate(`/datacenters`)} title="Revenir à la liste">Terminer</button>
                </div>
            </header>

            <main className="dc2d-main" onMouseLeave={onUp}>
                {loading ? (
                    <div className="dc2d-loading">Chargement…</div>
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

            <div className={`save-toast ${saving === "err" ? "err" : saving === "ok" ? "ok" : ""}`}>
                {saving === "saving" && "Sauvegarde…"}
                {saving === "ok" && "Enregistré ✓"}
                {saving === "err" && (errMsg || "Erreur de sauvegarde")}
            </div>

            {/* ------- PANNEAU D’ÉDITION / SUPPRESSION ------- */}
            {selection && (
                <div
                    style={{
                        position: "fixed",
                        right: 16,
                        top: 96,
                        width: 280,
                        background: "var(--panel, #0f1022)",
                        border: "1px solid var(--stroke, rgba(255,255,255,.08))",
                        borderRadius: 12,
                        padding: 12,
                        boxShadow: "0 8px 24px rgba(0,0,0,.35)",
                        zIndex: 50,
                        color: "#e9e9ff",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <strong>Propriétés</strong>
                        <button className="tool" onClick={() => setSelection(null)}>Fermer</button>
                    </div>

                    {/* RACK: nom + statut */}
                    {selection.kind === "rack" && (
                        <>
                            <div style={{ display: "grid", gap: 8 }}>
                                <label style={{ fontSize: 12, opacity: .85 }}>Nom du rack</label>
                                <input
                                    id="rack-name-input"
                                    defaultValue={rackName[selection.anchor] ?? ""}
                                    placeholder="Nom du rack"
                                    onChange={(ev) => setRackName(prev => ({ ...prev, [selection.anchor]: ev.target.value }))}
                                    style={{
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        border: "1px solid var(--stroke, rgba(255,255,255,.12))",
                                        background: "#12142a",
                                        color: "#fff",
                                    }}
                                />
                            </div>

                            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                                <label style={{ fontSize: 12, opacity: .85 }}>Statut</label>
                                <select
                                    id="rack-status-select"
                                    value={rackStatus[selection.anchor] ?? "prototype"}
                                    onChange={(ev) => setRackStatus(prev => ({ ...prev, [selection.anchor]: ev.target.value as RackStatus }))}
                                    style={{
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        border: "1px solid var(--stroke, rgba(255,255,255,.12))",
                                        background: "#12142a",
                                        color: "#fff",
                                    }}
                                >
                                    <option value="prototype">prototype</option>
                                    <option value="en marche">en marche</option>
                                    <option value="en arrêt">en arrêt</option>
                                </select>
                            </div>

                            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                <button className="tool" onClick={queueSave}>Enregistrer</button>
                                <button
                                    className="tool"
                                    onClick={deleteSelected}
                                    style={{ background: "#3a2327", color: "#ffd6de", borderColor: "#6b2a34" }}
                                >
                                    Supprimer
                                </button>
                            </div>
                        </>
                    )}

                    {/* DOOR / COOLING / ODF : suppression (gérée par bulk replace:true) */}
                    {selection.kind !== "rack" && (
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                            <button
                                className="tool"
                                onClick={deleteSelected}
                                style={{ background: "#3a2327", color: "#ffd6de", borderColor: "#6b2a34" }}
                            >
                                Supprimer
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

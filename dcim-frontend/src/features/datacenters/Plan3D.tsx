import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges } from "@react-three/drei";
import * as THREE from "three";
import "./Plan3D.css";

/** ===== Types alignés sur Plan2D ===== */
type RotMap = Record<string, number>;

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
    }>;
};

type Plan3DProps = {
    selectedId?: string | number | null;
    onSelect?: (id: string | number, label?: string) => void;
};

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

/** ===== Helpers 2D → 3D ===== */
const keyOf = (r: number, c: number) => `${r}:${c}`;
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

/** ====== Composant principal Plan3D ====== */
export default function Plan3D({ selectedId, onSelect }: Plan3DProps) {
    const { id = "" } = useParams();
    const navigate = useNavigate();

    // Grille
    const [rows, setRows] = useState(10);
    const [cols, setCols] = useState(18);

    // Racks
    const [rackSet, setRackSet] = useState<Set<string>>(new Set());
    const [rotRack, setRotRack] = useState<RotMap>({});
    const rackIdByPos = useRef<Map<string, number>>(new Map());

    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg] = useState<string | null>(null);

    // ---- Fetch DC ----
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
                const rr: RotMap = {};
                rackIdByPos.current.clear();

                for (const rk of dc.racks ?? []) {
                    const k = keyOf(rk.posRow, rk.posCol);
                    _rack.add(k);
                    rackIdByPos.current.set(k, rk.id);
                    rr[k] = rk.rotationDeg ?? 0;
                }
                setRackSet(_rack);
                setRotRack(rr);
                setLoading(false);
            } catch (e) {
                console.error(e);
                setErrMsg("Erreur de chargement.");
                setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [id]);

    /** ====== Paramètres géométrie ====== */
    const CELL = 1;          // taille d’une dalle (unité arbitraire)
    const RACK_H = 1.8;      // hauteur des racks
    const WALL_T = 0.12;     // épaisseur mur
    const WALL_H = 2.4;      // hauteur mur
    const DOOR_W = 1.6;      // largeur porte
    const DOOR_OFFSET = 0.25;
    const COOLING_WU = 1.2;
    const COOLING_HU = 0.7;
    const COOLING_DU = 0.18;
    const COOLING_MOUNT_Y = WALL_H * 0.75;
    const ODF_W = 0.6;
    const ODF_D = 0.5;
    const ODF_H = 2.0;

    /** ====== Racks positionnés ====== */
    const { boxes, areaSize } = useMemo(() => {
        const items: Array<{ key: string; x: number; z: number; w: number; d: number; rot: number }> = [];
        const totalW = cols * CELL;
        const totalD = rows * CELL;
        const offsetX = -totalW / 2 + CELL / 2;
        const offsetZ = -totalD / 2 + CELL / 2;

        for (const a of rackSet) {
            const [r, c] = a.split(":").map(Number);
            const rot = (rotRack[a] ?? 0) % 360;
            const horizontal = rot === 0 || rot === 180;
            const w = horizontal ? 2 * CELL : 1 * CELL;
            const d = horizontal ? 1 * CELL : 2 * CELL;
            const x = c * CELL + offsetX + (horizontal ? CELL / 2 : 0);
            const z = r * CELL + offsetZ + (horizontal ? 0 : CELL / 2);
            items.push({ key: a, x, z, w, d, rot });
        }
        return { boxes: items, areaSize: { w: totalW, d: totalD } };
    }, [rows, cols, rackSet, rotRack]);

    /** ====== Murs, porte, cooling, ODF ====== */
    const structures = useMemo(() => {
        const { w: TW, d: TD } = areaSize;

        const doorCenterX = 0;
        const doorHalf = DOOR_W / 2;
        const bottomLeftLen = TW / 2 - doorHalf;
        const bottomRightLen = TW / 2 - doorHalf;
        const wallY = WALL_H / 2;

        const bottomLeft = {
            pos: [(-TW / 2 + bottomLeftLen / 2), wallY, (-TD / 2 - WALL_T / 2)] as [number, number, number],
            size: [bottomLeftLen, WALL_H, WALL_T] as [number, number, number],
        };
        const bottomRight = {
            pos: [(TW / 2 - bottomRightLen / 2), wallY, (-TD / 2 - WALL_T / 2)] as [number, number, number],
            size: [bottomRightLen, WALL_H, WALL_T] as [number, number, number],
        };
        const topWall = {
            pos: [0, wallY, (TD / 2 + WALL_T / 2)] as [number, number, number],
            size: [TW, WALL_H, WALL_T] as [number, number, number],
        };
        const leftWall = {
            pos: [(-TW / 2 - WALL_T / 2), wallY, 0] as [number, number, number],
            size: [WALL_T, WALL_H, TD] as [number, number, number],
        };
        const rightWall = {
            pos: [(TW / 2 + WALL_T / 2), wallY, 0] as [number, number, number],
            size: [WALL_T, WALL_H, TD] as [number, number, number],
        };
        const door = {
            pos: [doorCenterX, WALL_H / 2, (-TD / 2 + DOOR_OFFSET)] as [number, number, number],
            size: [DOOR_W, WALL_H * 0.9, 0.04] as [number, number, number],
        };

        const coolings: Array<{ pos: [number, number, number]; size: [number, number, number] }> = [];
        const nbCooling = Math.max(2, Math.floor(rows / 4));
        for (let i = 0; i < nbCooling; i++) {
            const z = (-TD / 2) + (i + 1) * (TD / (nbCooling + 1));
            coolings.push({
                pos: [(TW / 2 - COOLING_DU / 2 - 0.02), COOLING_MOUNT_Y, z],
                size: [COOLING_DU, COOLING_HU, COOLING_WU],
            });
        }

        const odfs: Array<{ pos: [number, number, number]; size: [number, number, number] }> = [];
        const nbOdf = 2;
        for (let i = 0; i < nbOdf; i++) {
            const z = (-TD / 2) + (i + 1) * (TD / (nbOdf + 1));
            odfs.push({
                pos: [(-TW / 2 + ODF_D / 2 + 0.05), ODF_H / 2, z],
                size: [ODF_D, ODF_H, ODF_W],
            });
        }

        return { bottomLeft, bottomRight, topWall, leftWall, rightWall, door, coolings, odfs };
    }, [areaSize, rows]);

    const handleSelect = (key: string) => {
        const anchor = findRackAnchorAtKey(key, rackSet, rotRack);
        if (!anchor) return;
        const rid = rackIdByPos.current.get(anchor);
        if (rid !== undefined) onSelect?.(rid, anchor);
    };

    return (
        <div className="dc3d-page">
            <header className="dc3d-header">
                <div className="dc3d-title">
                    <span className="pill">Plan 3D</span>
                    <span className="dc-id">— {id}</span>
                </div>
                {errMsg && <div className="err">{errMsg}</div>}
            </header>

            <main className="dc3d-main">
                {loading ? (
                    <div className="dc3d-loading">Chargement…</div>
                ) : (
                    <Canvas className="dc3d-canvas" camera={{ position: [0, 8, 10], fov: 50 }}>
                        {/* Lumières */}
                        <ambientLight intensity={0.7} />
                        <directionalLight position={[6, 10, 6]} intensity={0.8} />

                        {/* Sol */}
                        <mesh rotation-x={-Math.PI / 2}>
                            <planeGeometry args={[areaSize.w + 2, areaSize.d + 2]} />
                            <meshStandardMaterial color="#0e1422" roughness={0.9} metalness={0.05} />
                        </mesh>

                        {/* Murs */}
                        {[
                            structures.bottomLeft,
                            structures.bottomRight,
                            structures.topWall,
                            structures.leftWall,
                            structures.rightWall,
                        ].map((w, idx) => (
                            <mesh key={`wall-${idx}`} position={w.pos}>
                                <boxGeometry args={w.size} />
                                <meshStandardMaterial color="#2a334a" roughness={0.8} metalness={0.1} />
                                <Edges>
                                    <lineBasicMaterial color="#111827" />
                                </Edges>
                            </mesh>
                        ))}

                        {/* Porte */}
                        <mesh position={structures.door.pos}>
                            <boxGeometry args={structures.door.size} />
                            <meshStandardMaterial color="#6dd4ff" roughness={0.3} metalness={0.2} />
                            <Edges>
                                <lineBasicMaterial color="#1a7ca6" />
                            </Edges>
                        </mesh>

                        {/* Cooling mural */}
                        {structures.coolings.map((c, i) => (
                            <mesh key={`cool-${i}`} position={c.pos}>
                                <boxGeometry args={c.size} />
                                <meshStandardMaterial color="#70b7ff" roughness={0.35} metalness={0.2} />
                                <Edges>
                                    <lineBasicMaterial color="#1b4f7a" />
                                </Edges>
                            </mesh>
                        ))}

                        {/* ODF */}
                        {structures.odfs.map((o, i) => (
                            <mesh key={`odf-${i}`} position={o.pos}>
                                <boxGeometry args={o.size} />
                                <meshStandardMaterial color="#ff66c4" roughness={0.45} metalness={0.2} />
                                <Edges>
                                    <lineBasicMaterial color="#7b2d60" />
                                </Edges>
                            </mesh>
                        ))}

                        {/* Racks */}
                        {boxes.map((b) => {
                            const isSelected = String(selectedId ?? "") === String(rackIdByPos.current.get(b.key) ?? "");
                            const subdivisions = 5; // mets 42 pour simuler 42U si tu veux

                            return (
                                <group
                                    key={b.key}
                                    position={[b.x, RACK_H / 2, b.z]}
                                    onClick={() => handleSelect(b.key)}
                                    onDoubleClick={() => {
                                        const rid = rackIdByPos.current.get(b.key);
                                        if (rid !== undefined) navigate(`/racks/${rid}`);
                                    }}
                                >
                                    <mesh>
                                        <boxGeometry args={[b.w, RACK_H, b.d]} />
                                        <meshStandardMaterial
                                            color={isSelected ? "#c88bff" : "#b55bff"}
                                            emissive={isSelected ? new THREE.Color("#7a2fb7") : new THREE.Color("#000000")}
                                            emissiveIntensity={isSelected ? 0.5 : 0}
                                            roughness={0.5}
                                            metalness={0.2}
                                        />
                                        <Edges>
                                            <lineBasicMaterial color="#111827" />
                                        </Edges>
                                    </mesh>

                                    {/* Traits internes (subdivisions visuelles) */}
                                    {Array.from({ length: subdivisions }).map((_, i) => (
                                        <lineSegments
                                            key={i}
                                            position={[0, -RACK_H / 2 + ((i + 1) * RACK_H) / (subdivisions + 1), 0]}
                                        >
                                            <edgesGeometry args={[new THREE.BoxGeometry(b.w, 0.01, b.d)]} />
                                            <lineBasicMaterial color="#2d1b3f" />
                                        </lineSegments>
                                    ))}
                                </group>
                            );
                        })}

                        <OrbitControls enablePan enableZoom enableRotate />
                    </Canvas>
                )}
            </main>
        </div>
    );
}

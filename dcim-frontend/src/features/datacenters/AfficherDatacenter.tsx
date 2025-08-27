import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./AfficherDatacenter.css";
import Plan2D from "./Plan2D";
import Plan3D from "./Plan3D";

type Datacenter = {
    id: string;
    name: string;
    gridRows?: number | null;
    gridCols?: number | null;
    gridCellSizeMm?: number | null;
    planUrl?: string | null;
};

type RackDTO = {
    id: string;
    label: string;
    rowSide?: string | null;
    gridRow?: number | null;
    gridCol?: number | null;
    rotationDeg?: number | null;
    servers?: number | null;
    switches?: number | null;
    temperatureC?: number | null;
    utilization?: number | null;
};

type RackVM = {
    id: string;
    label: string;
    row: "L" | "R";
    index: number;
    gridRow?: number | null;
    gridCol?: number | null;
    rotation?: 0 | 90 | 180 | 270;
    servers?: number;
    switches?: number;
    temperature?: number;
    utilization?: number;
};

function parseLabel(label: string): { index: number; row: "L" | "R" } {
    const m = label?.match(/^(\d{1,2})\/([LR])$/i);
    if (m) return { index: parseInt(m[1], 10), row: m[2].toUpperCase() as "L" | "R" };
    return { index: 1, row: "L" };
}

function dtoToVM(dto: RackDTO): RackVM {
    const parsed = parseLabel(dto.label);
    return {
        id: dto.id ?? dto.label,
        label: dto.label,
        row: (dto.rowSide?.toUpperCase() as "L" | "R") || parsed.row,
        index: parsed.index,
        gridRow: dto.gridRow ?? null,
        gridCol: dto.gridCol ?? null,
        rotation: (dto.rotationDeg as 0 | 90 | 180 | 270) ?? 0,
        servers: dto.servers ?? undefined,
        switches: dto.switches ?? undefined,
        temperature: dto.temperatureC ?? undefined,
        utilization: dto.utilization ?? undefined,
    };
}

export default function DatacenterPlanPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [dc, setDc] = useState<Datacenter | null>(null);
    const [racks, setRacks] = useState<RackVM[]>([]);
    const racksById = useMemo(() => {
        const map = new Map<string, RackVM>();
        racks.forEach((r) => map.set(String(r.id), r));
        return map;
    }, [racks]);

    const [selected, setSelected] = useState<RackVM | null>(null);

    const [mode, setMode] = useState<"2d" | "3d">("2d");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [source, setSource] = useState<"API" | "Mock">("Mock");

    const outerRef = useRef<HTMLDivElement | null>(null);
    const innerRef = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        function updateScale() {
            const outer = outerRef.current;
            const inner = innerRef.current;
            if (!outer || !inner) return;
            const ow = outer.clientWidth;
            const oh = outer.clientHeight;
            const iw = inner.scrollWidth || inner.clientWidth || 1;
            const ih = inner.scrollHeight || inner.clientHeight || 1;
            const s = Math.min(1, ow / iw, oh / ih);
            setScale(s > 0 && isFinite(s) ? s : 1);
        }
        const RO = (window as any).ResizeObserver;
        const ro = RO ? new RO(() => updateScale()) : null;
        if (outerRef.current && ro) ro.observe(outerRef.current);
        window.addEventListener("resize", updateScale);
        const i = setInterval(updateScale, 300);
        updateScale();
        return () => {
            if (ro && outerRef.current) ro.unobserve(outerRef.current);
            clearInterval(i);
            window.removeEventListener("resize", updateScale);
        };
    }, [mode, loading]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const base = (import.meta as any).env?.VITE_API_BASE_URL || "";
                const dcRes = await fetch(`${base}/api/datacenters/${id}`, {
                    credentials: "include",
                    headers: { Accept: "application/json" },
                });
                if (!dcRes.ok) throw new Error("Datacenter not found");
                const dcJson: Datacenter = await dcRes.json();

                const racksRes = await fetch(`${base}/api/datacenters/${id}/racks`, {
                    credentials: "include",
                    headers: { Accept: "application/json" },
                });
                if (!racksRes.ok) throw new Error("Failed to load racks");
                const racksJson: RackDTO[] = await racksRes.json();
                const mapped = racksJson.map(dtoToVM);

                if (mounted) {
                    setDc(dcJson);
                    setRacks(mapped);
                    setSelected(null);
                    setSource("API");
                }
            } catch (e: any) {
                const fallbackRacks: RackVM[] = Array.from({ length: 8 }, (_, i) => ({
                    id: `mock-${i + 1}`,
                    label: `${String(i + 1).padStart(2, "0")}/L`,
                    row: "L",
                    index: i + 1,
                    gridCol: i,
                    gridRow: 0,
                    rotation: 0,
                    servers: 10 + i,
                    switches: 2,
                    temperature: 24,
                    utilization: 35 + i,
                }));
                if (mounted) {
                    setDc({ id: String(id), name: `DC ${id}`, gridRows: 10, gridCols: 18, gridCellSizeMm: 600 });
                    setRacks(fallbackRacks);
                    setSelected(null);
                    setSource("Mock");
                    setErr(e?.message || "Loading error");
                }
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [id]);

    function handleSelectRack(rackId: string | number, maybeLabel?: string) {
        const r = racksById.get(String(rackId));
        if (r) setSelected(r);
        else {
            setSelected({
                id: String(rackId),
                label: maybeLabel ?? String(rackId),
                row: "L",
                index: 0,
            });
        }
    }

    return (
        <div className="afficher-dc">
            <header className="afficher-dc-header">
                <div className="brand">
                    <div className="brand-badge"></div>
                    <h1 className="brand-title">DCIM – Datacenter Plan {dc?.name ?? id}</h1>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="toggle">
                        <button onClick={() => setMode("2d")} className={`toggle-btn ${mode === "2d" ? "is-2d" : ""}`}>
                            2D View
                        </button>
                        <button onClick={() => setMode("3d")} className={`toggle-btn ${mode === "3d" ? "is-3d" : ""}`}>
                            3D View
                        </button>
                    </div>
                    <div className="meta" style={{ opacity: 0.7 }}>
                        Source: <strong>{source}</strong>
                    </div>
                </div>
                {err && (
                    <div className="meta" style={{ marginTop: 8, color: "#ffb4c0" }}>
                        Error: {err}
                    </div>
                )}
            </header>

            <div className="afficher-dc-main">
                <main className="plan">
                    {loading ? (
                        <div className="meta">Loading…</div>
                    ) : mode === "2d" ? (
                        <div ref={outerRef} style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
                            <div
                                ref={innerRef}
                                style={{
                                    transform: `scale(${scale})`,
                                    transformOrigin: "top left",
                                    width: "fit-content",
                                    height: "fit-content",
                                }}
                            >
                                <Plan2D
                                    selectedId={selected?.id}
                                    onSelect={(id: string | number, label?: string) => handleSelectRack(id, label)}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="plan3d-host">
                            <Plan3D
                                selectedId={selected?.id}
                                onSelect={(id: string | number, label?: string) => handleSelectRack(id, label)}
                            />
                        </div>
                    )}
                </main>

                <aside className="info-panel">
                    <div>
                        <h3>{selected ? `Rack ${selected.label ?? selected.id}` : "Select a rack"}</h3>
                        {!selected && <p className="meta">Click on a rack (2D or 3D) to see its details here.</p>}
                    </div>

                    {selected && (
                        <>
                            <div className="stat">
                                <span className="key">Name / Label</span>
                                <span className="value">{selected.label ?? "—"}</span>
                            </div>
                            <div className="stat">
                                <span className="key">Row</span>
                                <span className="value">
                  {selected.row === "L" ? "Left (L)" : selected.row === "R" ? "Right (R)" : "—"}
                </span>
                            </div>
                            <div className="stat">
                                <span className="key">Location</span>
                                <span className="value">
                  {selected.gridRow != null && selected.gridCol != null
                      ? `Row ${selected.gridRow + 1}, Column ${selected.gridCol + 1}`
                      : "—"}
                </span>
                            </div>
                            <div className="stat">
                                <span className="key">Rotation</span>
                                <span className="value">{selected.rotation ?? 0}°</span>
                            </div>
                            <div className="stat">
                                <span className="key">Utilization</span>
                                <span className="value">{selected.utilization != null ? `${selected.utilization}%` : "—"}</span>
                            </div>
                            <div className="stat">
                                <span className="key">Components</span>
                                <span className="value">
                  {(selected.servers ?? 0)} servers • {(selected.switches ?? 0)} switches
                </span>
                            </div>
                            <div className="stat">
                                <span className="key">Temperature</span>
                                <span className="value">
                  {selected.temperature != null ? `${selected.temperature} °C` : "—"}
                </span>
                            </div>

                            <div className="sep" />

                            <div className="actions">
                                <button className="btn btn-primary" onClick={() => navigate(`/racks/${selected.id}`)}>
                                    More details
                                </button>
                            </div>
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}

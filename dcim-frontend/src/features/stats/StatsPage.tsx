import { useEffect, useMemo, useState } from "react";
import "./StatsPage.css";

/** ===== Types côté front ===== */
type MiniDC = { id: string; name: string };
type KV = { key: string; count: number };
type RackUtil = { rackId: number; rackName: string; nbUnites: number; usedU: number; freeU: number; usagePct: number };

type StatsOverview = {
    totals: {
        datacenters: number;
        racks: number;
        components: number;
        ports: number;
        liaisons: number;
        projects: number;
        organizations: number;
    };
    racksByStatus: KV[];
    componentsByType: KV[];
    componentsByStatus: KV[];
    componentsByLayer: KV[];
    portsByKind: KV[];
    portsByConnectorTop: KV[];
    liaisonsByStatus: KV[];
    liaisonsByCableTypeTop: KV[];
};

type StatsByDC = {
    datacenterId: string;
    datacenterName: string;
    totals: {
        racks: number;
        components: number;
        ports: number;
        liaisons: number;
        siteAssets: number;
    };
    siteAssetsByKind: KV[];
    racksByStatus: KV[];
    componentsByType: KV[];
    componentsByStatus: KV[];
    componentsByLayer: KV[];
    portsByKind: KV[];
    liaisonsByStatus: KV[];
    rackUtilization: RackUtil[];
    infraFlags?: {
        hasGenerator?: boolean | null;
        hasFireExt?: boolean | null;
        hasEmergencyLight?: boolean | null;
        hasSecurity?: boolean | null;
        hasToilets?: boolean | null;
        coolingUnits?: number | null;
        coolingType?: string | null;
        powerPlant?: boolean | null;
        acVoltage?: string | null;
        phases?: string | null;
        frequency?: number | null;
    }
};

type LoadingState = "idle" | "loading" | "error";

/** ===== Helpers rendu mini-graph bar ===== */
function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="barrow">
            <div className="barrow-label">{label}</div>
            <div className="barrow-bar">
                <div className="barrow-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="barrow-value">{value}</div>
        </div>
    );
}

export default function StatsPage() {
    const [dcList, setDcList] = useState<MiniDC[]>([]);
    const [selectedDc, setSelectedDc] = useState<string>("");
    const [overview, setOverview] = useState<StatsOverview | null>(null);
    const [byDc, setByDc] = useState<StatsByDC | null>(null);
    const [state, setState] = useState<LoadingState>("idle");
    const [err, setErr] = useState<string | null>(null);

    // Charge la liste des datacenters (id, name) — minimal
    useEffect(() => {
        const run = async () => {
            try {
                const r = await fetch("/api/datacenters?fields=id,name", { credentials: "include" });
                if (!r.ok) throw new Error(await r.text());
                const rows: MiniDC[] = await r.json();
                setDcList(rows);
            } catch (e: any) {
                // on ne bloque pas la page stats si ça échoue
                console.warn("DC list fetch error:", e?.message || e);
            }
        };
        run();
    }, []);

    // Charge l’overview (global)
    useEffect(() => {
        const run = async () => {
            setState("loading");
            setErr(null);
            try {
                const r = await fetch("/api/stats/overview", { credentials: "include" });
                if (!r.ok) throw new Error(await r.text());
                const data: StatsOverview = await r.json();
                setOverview(data);
                setState("idle");
            } catch (e: any) {
                setErr(e?.message ?? "Erreur");
                setState("error");
            }
        };
        run();
    }, []);

    // Charge stats par DC à la demande
    useEffect(() => {
        const run = async () => {
            if (!selectedDc) { setByDc(null); return; }
            try {
                setState("loading");
                const r = await fetch(`/api/stats/datacenter/${selectedDc}`, { credentials: "include" });
                if (!r.ok) throw new Error(await r.text());
                const data: StatsByDC = await r.json();
                setByDc(data);
                setState("idle");
            } catch (e: any) {
                setErr(e?.message ?? "Erreur");
                setState("error");
            }
        };
        run();
    }, [selectedDc]);

    /** ====== Rendus helpers ====== */
    const kpiCard = (title: string, value: number | string, hint?: string) => (
        <div className="stat-card" key={title}>
            <div className="stat-title">{title}</div>
            <div className="stat-value">{value}</div>
            {hint && <div className="stat-hint">{hint}</div>}
        </div>
    );

    const Section = ({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) => (
        <div className="section-card">
            <div className="section-head">
                <h3>{title}</h3>
                {right}
            </div>
            <div>{children}</div>
        </div>
    );

    /** ====== Contenu OVERVIEW ====== */
    const overviewContent = useMemo(() => {
        if (!overview) return null;
        const t = overview.totals;

        const maxCompType = Math.max(1, ...overview.componentsByType.map(x => x.count));
        const maxLayer = Math.max(1, ...overview.componentsByLayer.map(x => x.count));
        const maxPortKind = Math.max(1, ...overview.portsByKind.map(x => x.count));
        const maxRackStatus = Math.max(1, ...overview.racksByStatus.map(x => x.count));
        const maxLinkStatus = Math.max(1, ...overview.liaisonsByStatus.map(x => x.count));

        return (
            <>
                <div className="kpi-grid">
                    {kpiCard("Datacenters", t.datacenters)}
                    {kpiCard("Racks", t.racks)}
                    {kpiCard("Composants", t.components)}
                    {kpiCard("Ports", t.ports)}
                    {kpiCard("Liaisons", t.liaisons)}
                    {kpiCard("Projets", t.projects)}
                    {kpiCard("Organisations", t.organizations)}
                </div>

                <div className="grid-2">
                    <Section title="Composants par type">
                        {overview.componentsByType.length === 0 && <div className="empty">Aucune donnée</div>}
                        {overview.componentsByType.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxCompType} />
                        ))}
                    </Section>

                    <Section title="Couches (Physique / Logique)">
                        {overview.componentsByLayer.length === 0 && <div className="empty">Aucune donnée</div>}
                        {overview.componentsByLayer.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxLayer} />
                        ))}
                    </Section>

                    <Section title="Statut des racks">
                        {overview.racksByStatus.length === 0 && <div className="empty">Aucune donnée</div>}
                        {overview.racksByStatus.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxRackStatus} />
                        ))}
                    </Section>

                    <Section title="Ports par kind">
                        {overview.portsByKind.length === 0 && <div className="empty">Aucune donnée</div>}
                        {overview.portsByKind.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxPortKind} />
                        ))}
                    </Section>

                    <Section title="Liaisons par statut">
                        {overview.liaisonsByStatus.length === 0 && <div className="empty">Aucune donnée</div>}
                        {overview.liaisonsByStatus.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxLinkStatus} />
                        ))}
                    </Section>

                    <Section title="Top connecteurs de ports" right={<div className="hint">Top 8</div>}>
                        {overview.portsByConnectorTop.length === 0 && <div className="empty">Aucune donnée</div>}
                        {overview.portsByConnectorTop.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={overview.portsByConnectorTop[0]?.count || 1} />
                        ))}
                    </Section>

                    <Section title="Top types de câble (catalogue)" right={<div className="hint">Top 8</div>}>
                        {overview.liaisonsByCableTypeTop.length === 0 && <div className="empty">Aucune donnée</div>}
                        {overview.liaisonsByCableTypeTop.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={overview.liaisonsByCableTypeTop[0]?.count || 1} />
                        ))}
                    </Section>
                </div>
            </>
        );
    }, [overview]);

    /** ====== Contenu PAR DATACENTER ====== */
    const byDcContent = useMemo(() => {
        if (!byDc) return null;
        const t = byDc.totals;

        const maxSA = Math.max(1, ...byDc.siteAssetsByKind.map(x => x.count));
        const maxCompType = Math.max(1, ...byDc.componentsByType.map(x => x.count));
        const maxLayer = Math.max(1, ...byDc.componentsByLayer.map(x => x.count));
        const maxRackStatus = Math.max(1, ...byDc.racksByStatus.map(x => x.count));
        const maxPortKind = Math.max(1, ...byDc.portsByKind.map(x => x.count));
        const maxLinkStatus = Math.max(1, ...byDc.liaisonsByStatus.map(x => x.count));

        return (
            <>
                <div className="kpi-grid">
                    {kpiCard("Racks", t.racks)}
                    {kpiCard("Composants", t.components)}
                    {kpiCard("Ports", t.ports)}
                    {kpiCard("Liaisons", t.liaisons)}
                    {kpiCard("Assets de site", t.siteAssets)}
                </div>

                {byDc.infraFlags && (
                    <div className="flags-row">
                        {["hasGenerator","hasFireExt","hasEmergencyLight","hasSecurity","hasToilets"].map(k => {
                            const val = (byDc.infraFlags as any)[k];
                            return (
                                <div className={"flag "+(val ? "ok":"no")} key={k}>
                                    <span className="flag-dot"/>{k.replace("has","")}
                                </div>
                            );
                        })}
                        {(byDc.infraFlags.coolingUnits != null || byDc.infraFlags.coolingType) && (
                            <div className="flag info"><span className="flag-dot" />Cooling: {byDc.infraFlags.coolingUnits ?? "?"} · {byDc.infraFlags.coolingType ?? "-"}</div>
                        )}
                        {(byDc.infraFlags.acVoltage || byDc.infraFlags.phases || byDc.infraFlags.frequency) && (
                            <div className="flag info"><span className="flag-dot" />Power: {byDc.infraFlags.acVoltage ?? "-"} · {byDc.infraFlags.phases ?? "-"} · {byDc.infraFlags.frequency ?? "-"}Hz</div>
                        )}
                    </div>
                )}

                <div className="grid-2">
                    <Section title="Assets de site (portes, cooling, ODF...)">
                        {byDc.siteAssetsByKind.length === 0 && <div className="empty">Aucune donnée</div>}
                        {byDc.siteAssetsByKind.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxSA} />
                        ))}
                    </Section>

                    <Section title="Statut des racks">
                        {byDc.racksByStatus.length === 0 && <div className="empty">Aucune donnée</div>}
                        {byDc.racksByStatus.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxRackStatus} />
                        ))}
                    </Section>

                    <Section title="Composants par type">
                        {byDc.componentsByType.length === 0 && <div className="empty">Aucune donnée</div>}
                        {byDc.componentsByType.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxCompType} />
                        ))}
                    </Section>

                    <Section title="Couches (Physique / Logique)">
                        {byDc.componentsByLayer.length === 0 && <div className="empty">Aucune donnée</div>}
                        {byDc.componentsByLayer.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxLayer} />
                        ))}
                    </Section>

                    <Section title="Ports par kind">
                        {byDc.portsByKind.length === 0 && <div className="empty">Aucune donnée</div>}
                        {byDc.portsByKind.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxPortKind} />
                        ))}
                    </Section>

                    <Section title="Liaisons par statut">
                        {byDc.liaisonsByStatus.length === 0 && <div className="empty">Aucune donnée</div>}
                        {byDc.liaisonsByStatus.map(row => (
                            <BarRow key={row.key} label={row.key} value={row.count} max={maxLinkStatus} />
                        ))}
                    </Section>
                </div>

                <Section title="Utilisation des racks (U)">
                    {byDc.rackUtilization.length === 0 && <div className="empty">Aucune donnée</div>}
                    <div className="util-table">
                        <div className="util-head">
                            <div>Rack</div><div>U totaux</div><div>U utilisés</div><div>U libres</div><div>Usage</div>
                        </div>
                        {byDc.rackUtilization.map(r => (
                            <div className="util-row" key={r.rackId}>
                                <div>{r.rackName}</div>
                                <div>{r.nbUnites}</div>
                                <div>{r.usedU}</div>
                                <div>{r.freeU}</div>
                                <div>
                                    <div className="util-bar"><div className="util-fill" style={{ width: `${r.usagePct}%` }} /></div>
                                    <span className="util-pct">{r.usagePct.toFixed(0)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            </>
        );
    }, [byDc]);

    return (
        <div className="stats-wrap">
            <div className="stats-head">
                <div>
                    <h1 className="title">Statistiques & KPIs</h1>
                    <p className="sub">Aperçu global et par datacenter des racks, composants, ports, liaisons, et ressources de site.</p>
                </div>
                <div className="dc-picker">
                    <label>
                        <span>Filtrer par datacenter</span>
                        <select value={selectedDc} onChange={e => setSelectedDc(e.target.value)}>
                            <option value="">— Tous (overview) —</option>
                            {dcList.map(dc => (
                                <option key={dc.id} value={dc.id}>{dc.name}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            {err && <div className="err">{err}</div>}
            {state === "loading" && <div className="loading">Chargement…</div>}

            {!selectedDc ? overviewContent : byDcContent}
        </div>
    );
}

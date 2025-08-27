import React, { useMemo } from "react";

/* ========= Types minimalistes importés localement ========= */
interface Composant {
    id: number;
    nom: string;
    type: string;
    modele: string;
    statut: string;
    layer?: "PHYSICAL" | "LOGICAL";
    hosts?: Composant[];
}
interface Unite {
    id: number;
    numero: number;
    composant?: Composant | null; // PHYSICAL
    logicals?: Composant[];
}
interface RackData {
    id: number;
    nom: string;
    nbUnites: number;
    unites: Unite[];
}

type Props = {
    rack: RackData;
    showPhysical: boolean;
    showLogical: boolean;
};

const statusDot = (statut?: string) => {
    const map: Record<string, string> = {
        actif: "dot dot-ok",
        maintenance: "dot dot-warn",
        en_panne: "dot dot-danger",
        inactif: "dot dot-muted",
    };
    return <span className={map[statut || ""] || "dot"} />;
};

const composantCell = (c?: Composant | null) => {
    if (!c) return <span className="muted">Vide</span>;
    return (
        <div className="cell-comp">
            {statusDot(c.statut)}
            <div className="cell-comp-texts">
                <div className="cell-comp-title">{c.nom || c.type}</div>
                <div className="cell-comp-sub muted">
                    {c.type} {c.modele ? `· ${c.modele}` : ""}
                </div>
            </div>
        </div>
    );
};

export default function RackUnitsTable({
                                           rack,
                                           showPhysical,
                                           showLogical,
                                       }: Props) {
    const rows = useMemo(() => {
        const map = new Map<number, Unite>();
        // Générer toutes les U (Umax → U1)
        for (let u = rack.nbUnites; u >= 1; u--) {
            map.set(u, { id: u, numero: u });
        }
        // Injecter les données existantes
        for (const u of rack.unites || []) map.set(u.numero, u);
        return Array.from(map.values()).sort((a, b) => b.numero - a.numero);
    }, [rack]);

    const showPhys = showPhysical || !showLogical; // si rien coché → on montre Physique
    const showLogi = showLogical;

    return (
        <div className="units-table">
            <div
                className={
                    "units-header " +
                    (showPhys && showLogi ? "cols-3" : "cols-2")
                }
            >
                <div>U</div>
                {showPhys && <div>Composantes physiques</div>}
                {showLogi && <div>Composantes logiques</div>}
            </div>

            <div className="units-body">
                {rows.map((ru) => {
                    const physical = ru.composant;
                    // logiques : soit via ru.logicals, soit via physical.hosts
                    const logicals = ru.logicals ?? physical?.hosts ?? [];

                    return (
                        <div
                            key={ru.numero}
                            className={
                                "unit-row " + (showPhys && showLogi ? "cols-3" : "cols-2")
                            }
                        >
                            <div className="u-col">U{ru.numero}</div>

                            {showPhys && <div className="phys-col">{composantCell(physical)}</div>}

                            {showLogi && (
                                <div className="logic-col">
                                    {logicals.length === 0 ? (
                                        <span className="muted">—</span>
                                    ) : (
                                        logicals.map((lc) => (
                                            <div key={lc.id} className="logic-pill">
                                                {statusDot(lc.statut)}
                                                <span className="pill-label">
                          {lc.nom || lc.type}
                        </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

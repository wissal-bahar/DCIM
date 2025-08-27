import React from "react";


interface RackData {
    id: number;
    nom: string;
    localisation: string;
    nbUnites: number;
    status: string;
    description?: string;
}

type Props = {
    rack: RackData;
    showPhysical: boolean;
    showLogical: boolean;
    onTogglePhysical: () => void;
    onToggleLogical: () => void;
    onAddComponent: () => void;
    onEditRack?: () => void;
    onDeleteRack?: () => void;
    onInfo?: () => void;
};

export default function RackActions({
                                        rack,
                                        showPhysical,
                                        showLogical,
                                        onTogglePhysical,
                                        onToggleLogical,
                                        onAddComponent,
                                        onEditRack,
                                        onDeleteRack,
                                        onInfo,
                                    }: Props) {
    return (
        <div className="actions-wrap">
            {/* Carte info compacte */}
            <div className="glass-card side-card">
                <div className="side-title">Informations</div>
                <div className="side-line">
                    <span className="muted">Nom</span>
                    <strong>{rack.nom}</strong>
                </div>
                <div className="side-line">
                    <span className="muted">Localisation</span>
                    <strong>{rack.localisation}</strong>
                </div>
                <div className="side-line">
                    <span className="muted">Capacité</span>
                    <strong>{rack.nbUnites}U</strong>
                </div>
                {rack.description ? (
                    <div className="side-desc">{rack.description}</div>
                ) : null}


            </div>

            {/* Ajouter composante */}
            <div className="glass-card side-actions">
                <button className="btn btn-glow w-full" onClick={onAddComponent}>
                    + Ajouter composante
                </button>
            </div>

            {/* Toggles Physique / Logique */}
            <div className="glass-card side-toggles">
                <div className="side-title">Affichage</div>
                <div className="toggle-row">
                    <button
                        className={`toggle ${showPhysical ? "is-on" : ""}`}
                        onClick={onTogglePhysical}
                    >
                        Physique
                    </button>
                    <button
                        className={`toggle ${showLogical ? "is-on" : ""}`}
                        onClick={onToggleLogical}
                    >
                        Logique
                    </button>
                </div>
                <div className="muted small" style={{ marginTop: 8 }}>
                    • Un seul actif → une seule colonne. • Les deux actifs → Physique &
                    Logique côte à côte.
                </div>
            </div>
        </div>
    );
}

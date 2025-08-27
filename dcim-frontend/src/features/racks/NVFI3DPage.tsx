import React, { Suspense } from "react";

// corrige le chemin : deux niveaux au-dessus (on est dans src/features/racks)
// puis dossier nfvi3d et fichier NFVI3D.tsx
const NVFIApp = React.lazy(() => import("../../nfvi3d/NFVI3D"));

export default function NVFI3DPage() {
    return (
        <div style={{ width: "100%", height: "100%", background: "#0e0a1f" }}>
            <Suspense fallback={<div style={{ color: "white" }}>Chargement 3D…</div>}>
                <NVFIApp />
            </Suspense>
        </div>
    );
}

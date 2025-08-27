import { useEffect, useMemo, useState, FormEvent } from "react";
import "./SettingsCatalogPage.css";

/** ====== Types (alignés avec ton schéma Prisma) ====== */
type RackModel = {
    id: string;
    manufacturer: string;
    modelRef: string;
    sku?: string | null;
    uHeight: number;
    heightMm?: number | null;
    widthMm?: number | null;
    depthMm?: number | null;
    staticLoadKg?: number | null;
    dynamicLoadKg?: number | null;
    frontDoorStyle?: string | null;
    rearDoorStyle?: string | null;
    doorOpenAreaPct?: number | null;
    color?: string | null;
    warrantyYears?: number | null;
    shockPalletSupported?: boolean | null;
    shipPreconfiguredOk?: boolean | null;
    createdAt?: string;
};

type PhysicalComponentModel = {
    id: string;
    vendor: string;
    model: string;
    function: string; // ← enum PhysicalFunction côté Prisma
    ports?: number | null;
    notes?: string | null;
    createdAt?: string;
};

type CableTypeRef = {
    id: string;
    code: string;
    label?: string | null;
    vendor?: string | null;
    category?: string | null; // ← enum CableType côté Prisma
    defaultSpeed?: string | null;
    defaultLengthM?: number | null;
    notes?: string | null;
    createdAt?: string;
};

type Organization = {
    id: string;
    name: string;
    type: string; // ← enum OrgType côté Prisma
    country?: string | null;
    notes?: string | null;
    createdAt?: string;
};

/** Aide: petites listes par défaut si tes enums existent différemment, ajuste ici */
const PHYSICAL_FUNCTIONS = ["SERVER", "SWITCH", "STORAGE", "ROUTER", "FIREWALL", "OTHER"];
const CABLE_CATEGORIES = ["FIBER", "COPPER", "POWER", "PATCH", "OTHER"];
const RACK_DOOR_STYLES = ["MESH", "PERFORATED", "SOLID", "NONE"];
const RACK_COLORS = ["BLACK", "GRAY", "WHITE", "OTHER"];
const ORG_TYPES = ["CLIENT", "SUPPLIER", "PARTNER", "INTERNAL"];

type TabKey = "rackModels" | "componentModels" | "cableTypes" | "orgs";

export default function SettingsCatalogPage() {
    const [active, setActive] = useState<TabKey>("rackModels");

    /** ====== States par onglet ====== */
    const [rackModels, setRackModels] = useState<RackModel[]>([]);
    const [componentModels, setComponentModels] = useState<PhysicalComponentModel[]>([]);
    const [cableTypes, setCableTypes] = useState<CableTypeRef[]>([]);
    const [orgs, setOrgs] = useState<Organization[]>([]);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    /** ====== Fetchers ====== */
    const fetchAll = async () => {
        setLoading(true);
        setErr(null);
        try {
            const [rm, pm, ct, og] = await Promise.all([
                fetch("/api/catalog/rack-models", { credentials: "include" }),
                fetch("/api/catalog/component-models", { credentials: "include" }),
                fetch("/api/catalog/cable-types", { credentials: "include" }),
                fetch("/api/orgs", { credentials: "include" }),
            ]);
            if (!rm.ok || !pm.ok || !ct.ok || !og.ok) throw new Error("Erreur de chargement");
            setRackModels(await rm.json());
            setComponentModels(await pm.json());
            setCableTypes(await ct.json());
            setOrgs(await og.json());
        } catch (e: any) {
            setErr(e.message ?? "Erreur");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Charge tout dès l’ouverture
        fetchAll();
    }, []);

    /** ====== Handlers POST génériques ====== */
    async function postJSON(url: string, body: any) {
        setErr(null);
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const t = await res.text();
            throw new Error(t || `POST ${url} a échoué`);
        }
        return res.json();
    }

    /** ====== Forms state (uncontrolled via FormData) ====== */

    /** ====== Rendu du header ====== */
    const Title = useMemo(
        () => (
            <div className="sc-header">
                <div>
                    <h1 className="sc-title">Paramètres · Catalogue</h1>
                    <p className="sc-sub">Ajoutez et maintenez les modèles réutilisables (racks, composantes, câbles, organisations).</p>
                </div>
            </div>
        ),
        []
    );

    /** ====== Onglets ====== */
    const Tabs = (
        <div className="sc-tabs">
            <button className={active === "rackModels" ? "active" : ""} onClick={() => setActive("rackModels")}>
                Modèles de rack
            </button>
            <button className={active === "componentModels" ? "active" : ""} onClick={() => setActive("componentModels")}>
                Modèles de composante
            </button>
            <button className={active === "cableTypes" ? "active" : ""} onClick={() => setActive("cableTypes")}>
                Types de câble
            </button>
            <button className={active === "orgs" ? "active" : ""} onClick={() => setActive("orgs")}>
                Organisations
            </button>
        </div>
    );

    /** ====== Cartes: LISTE ====== */
    const RackModelsList = (
        <div className="sc-card">
            <div className="sc-card-head">
                <h3>Catalogue · Modèles de rack</h3>
            </div>
            <div className="sc-table">
                <div className="sc-tr sc-tr--head">
                    <div>Fabricant</div>
                    <div>Réf.</div>
                    <div>U</div>
                    <div>Couleur</div>
                    <div>Avant/Arrière</div>
                    <div>Charge stat.</div>
                    <div>Garantie</div>
                </div>
                {rackModels.map((r) => (
                    <div className="sc-tr" key={r.id}>
                        <div>{r.manufacturer}</div>
                        <div>{r.modelRef}</div>
                        <div>{r.uHeight}</div>
                        <div>{r.color ?? "-"}</div>
                        <div>
                            {r.frontDoorStyle ?? "-"} / {r.rearDoorStyle ?? "-"}
                        </div>
                        <div>{r.staticLoadKg ?? "-"} kg</div>
                        <div>{r.warrantyYears ?? "-"} an(s)</div>
                    </div>
                ))}
                {rackModels.length === 0 && <div className="sc-empty">Aucun modèle pour l’instant.</div>}
            </div>
        </div>
    );

    const ComponentModelsList = (
        <div className="sc-card">
            <div className="sc-card-head">
                <h3>Catalogue · Modèles de composante</h3>
            </div>
            <div className="sc-table">
                <div className="sc-tr sc-tr--head">
                    <div>Vendor</div>
                    <div>Modèle</div>
                    <div>Fonction</div>
                    <div>Ports</div>
                    <div>Notes</div>
                </div>
                {componentModels.map((m) => (
                    <div className="sc-tr" key={m.id}>
                        <div>{m.vendor}</div>
                        <div>{m.model}</div>
                        <div>{m.function}</div>
                        <div>{m.ports ?? "-"}</div>
                        <div className="truncate">{m.notes ?? "-"}</div>
                    </div>
                ))}
                {componentModels.length === 0 && <div className="sc-empty">Aucun modèle pour l’instant.</div>}
            </div>
        </div>
    );

    const CableTypesList = (
        <div className="sc-card">
            <div className="sc-card-head">
                <h3>Catalogue · Types de câble</h3>
            </div>
            <div className="sc-table">
                <div className="sc-tr sc-tr--head">
                    <div>Code</div>
                    <div>Label</div>
                    <div>Vendor</div>
                    <div>Catégorie</div>
                    <div>Vitesse</div>
                    <div>Longueur (m)</div>
                </div>
                {cableTypes.map((c) => (
                    <div className="sc-tr" key={c.id}>
                        <div className="truncate">{c.code}</div>
                        <div>{c.label ?? "-"}</div>
                        <div>{c.vendor ?? "-"}</div>
                        <div>{c.category ?? "-"}</div>
                        <div>{c.defaultSpeed ?? "-"}</div>
                        <div>{c.defaultLengthM ?? "-"}</div>
                    </div>
                ))}
                {cableTypes.length === 0 && <div className="sc-empty">Aucun type pour l’instant.</div>}
            </div>
        </div>
    );

    const OrgsList = (
        <div className="sc-card">
            <div className="sc-card-head">
                <h3>Organisations</h3>
            </div>
            <div className="sc-table">
                <div className="sc-tr sc-tr--head">
                    <div>Nom</div>
                    <div>Type</div>
                    <div>Pays</div>
                    <div>Notes</div>
                </div>
                {orgs.map((o) => (
                    <div className="sc-tr" key={o.id}>
                        <div>{o.name}</div>
                        <div>{o.type}</div>
                        <div>{o.country ?? "-"}</div>
                        <div className="truncate">{o.notes ?? "-"}</div>
                    </div>
                ))}
                {orgs.length === 0 && <div className="sc-empty">Aucune organisation pour l’instant.</div>}
            </div>
        </div>
    );

    /** ====== Cartes: FORM AJOUT ====== */
    async function submitRackModel(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body = {
            manufacturer: fd.get("manufacturer")?.toString().trim(),
            modelRef: fd.get("modelRef")?.toString().trim(),
            sku: emptyToNull(fd.get("sku")),
            uHeight: Number(fd.get("uHeight") || 0),
            heightMm: numOrNull(fd.get("heightMm")),
            widthMm: numOrNull(fd.get("widthMm")),
            depthMm: numOrNull(fd.get("depthMm")),
            staticLoadKg: numOrNull(fd.get("staticLoadKg")),
            dynamicLoadKg: numOrNull(fd.get("dynamicLoadKg")),
            frontDoorStyle: emptyToNull(fd.get("frontDoorStyle")),
            rearDoorStyle: emptyToNull(fd.get("rearDoorStyle")),
            doorOpenAreaPct: numOrNull(fd.get("doorOpenAreaPct")),
            color: emptyToNull(fd.get("color")),
            warrantyYears: numOrNull(fd.get("warrantyYears")),
            shockPalletSupported: boolOrNull(fd.get("shockPalletSupported")),
            shipPreconfiguredOk: boolOrNull(fd.get("shipPreconfiguredOk")),
        };
        await postJSON("/api/catalog/rack-models", body);
        (e.target as HTMLFormElement).reset();
        fetchAll();
    }

    async function submitComponentModel(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body = {
            vendor: fd.get("vendor")?.toString().trim(),
            model: fd.get("model")?.toString().trim(),
            function: fd.get("function")?.toString().trim(),
            ports: numOrNull(fd.get("ports")),
            notes: emptyToNull(fd.get("notes")),
        };
        await postJSON("/api/catalog/component-models", body);
        (e.target as HTMLFormElement).reset();
        fetchAll();
    }

    async function submitCableType(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body = {
            code: fd.get("code")?.toString().trim(),
            label: emptyToNull(fd.get("label")),
            vendor: emptyToNull(fd.get("vendor")),
            category: emptyToNull(fd.get("category")),
            defaultSpeed: emptyToNull(fd.get("defaultSpeed")),
            defaultLengthM: numOrNull(fd.get("defaultLengthM")),
            notes: emptyToNull(fd.get("notes")),
        };
        await postJSON("/api/catalog/cable-types", body);
        (e.target as HTMLFormElement).reset();
        fetchAll();
    }

    async function submitOrg(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body = {
            name: fd.get("name")?.toString().trim(),
            type: fd.get("type")?.toString().trim(),
            country: emptyToNull(fd.get("country")),
            notes: emptyToNull(fd.get("notes")),
        };
        await postJSON("/api/orgs", body);
        (e.target as HTMLFormElement).reset();
        fetchAll();
    }

    /** ====== Utils ====== */
    function emptyToNull(v: FormDataEntryValue | null): string | null {
        const s = v?.toString().trim();
        return s ? s : null;
    }
    function numOrNull(v: FormDataEntryValue | null): number | null {
        const s = v?.toString().trim();
        if (!s) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }
    function boolOrNull(v: FormDataEntryValue | null): boolean | null {
        const s = v?.toString();
        if (!s) return null;
        return s === "on" || s === "true";
    }

    /** ====== Form Cards ====== */
    const RackModelForm = (
        <form className="sc-card sc-form" onSubmit={submitRackModel}>
            <div className="sc-card-head">
                <h3>Ajouter · Modèle de rack</h3>
            </div>
            <div className="sc-grid">
                <label>
                    Fabricant*
                    <input name="manufacturer" required placeholder="Ex: APC / Rittal / Vertiv" />
                </label>
                <label>
                    Référence/Modèle*
                    <input name="modelRef" required placeholder="Ex: NetShelter SX 42U" />
                </label>
                <label>
                    SKU
                    <input name="sku" placeholder="Ex: AR3100" />
                </label>
                <label>
                    Hauteur (U)*
                    <input name="uHeight" type="number" min={1} required placeholder="42" />
                </label>
                <label>
                    Hauteur (mm)
                    <input name="heightMm" type="number" min={0} placeholder="1991" />
                </label>
                <label>
                    Largeur (mm)
                    <input name="widthMm" type="number" min={0} placeholder="600" />
                </label>
                <label>
                    Profondeur (mm)
                    <input name="depthMm" type="number" min={0} placeholder="1070" />
                </label>
                <label>
                    Charge statique (kg)
                    <input name="staticLoadKg" type="number" min={0} placeholder="1200" />
                </label>
                <label>
                    Charge dynamique (kg)
                    <input name="dynamicLoadKg" type="number" min={0} placeholder="900" />
                </label>
                <label>
                    Style porte avant
                    <select name="frontDoorStyle" defaultValue="">
                        <option value="">—</option>
                        {RACK_DOOR_STYLES.map((v) => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Style porte arrière
                    <select name="rearDoorStyle" defaultValue="">
                        <option value="">—</option>
                        {RACK_DOOR_STYLES.map((v) => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </label>
                <label>
                    % d’ouverture porte
                    <input name="doorOpenAreaPct" type="number" min={0} max={100} placeholder="80" />
                </label>
                <label>
                    Couleur
                    <select name="color" defaultValue="">
                        <option value="">—</option>
                        {RACK_COLORS.map((v) => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Garantie (années)
                    <input name="warrantyYears" type="number" min={0} placeholder="2" />
                </label>
                <label className="sc-check">
                    <input name="shockPalletSupported" type="checkbox" />
                    Supporte “shock pallet”
                </label>
                <label className="sc-check">
                    <input name="shipPreconfiguredOk" type="checkbox" />
                    Expédition préconfigurée OK
                </label>
            </div>
            <div className="sc-actions">
                <button type="submit" className="sc-btn sc-primary">Ajouter</button>
            </div>
        </form>
    );

    const ComponentModelForm = (
        <form className="sc-card sc-form" onSubmit={submitComponentModel}>
            <div className="sc-card-head">
                <h3>Ajouter · Modèle de composante</h3>
            </div>
            <div className="sc-grid">
                <label>
                    Vendor*
                    <input name="vendor" required placeholder="Ex: Dell / HPE / Cisco" />
                </label>
                <label>
                    Modèle*
                    <input name="model" required placeholder="Ex: R740, Catalyst 9300..." />
                </label>
                <label>
                    Fonction*
                    <select name="function" defaultValue={PHYSICAL_FUNCTIONS[0]} required>
                        {PHYSICAL_FUNCTIONS.map((v) => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Ports
                    <input name="ports" type="number" min={0} placeholder="Ex: 24" />
                </label>
                <label className="sc-col-2">
                    Notes
                    <textarea name="notes" placeholder="Détails, versions, options..."></textarea>
                </label>
            </div>
            <div className="sc-actions">
                <button type="submit" className="sc-btn sc-primary">Ajouter</button>
            </div>
        </form>
    );

    const CableTypeForm = (
        <form className="sc-card sc-form" onSubmit={submitCableType}>
            <div className="sc-card-head">
                <h3>Ajouter · Type de câble</h3>
            </div>
            <div className="sc-grid">
                <label className="sc-col-2">
                    Code*
                    <input name="code" required placeholder='Ex: "RPM 777 054/030000"' />
                </label>
                <label>
                    Label
                    <input name="label" placeholder="Ex: Fiber LC-LC OM4" />
                </label>
                <label>
                    Vendor
                    <input name="vendor" placeholder="Ex: Ericsson / Leviton..." />
                </label>
                <label>
                    Catégorie
                    <select name="category" defaultValue="">
                        <option value="">—</option>
                        {CABLE_CATEGORIES.map((v) => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Vitesse
                    <input name="defaultSpeed" placeholder="Ex: 10G / 100G" />
                </label>
                <label>
                    Longueur par défaut (m)
                    <input name="defaultLengthM" type="number" min={0} step="0.1" placeholder="3" />
                </label>
                <label className="sc-col-2">
                    Notes
                    <textarea name="notes" placeholder="Infos supplémentaires..."></textarea>
                </label>
            </div>
            <div className="sc-actions">
                <button type="submit" className="sc-btn sc-primary">Ajouter</button>
            </div>
        </form>
    );

    const OrgForm = (
        <form className="sc-card sc-form" onSubmit={submitOrg}>
            <div className="sc-card-head">
                <h3>Ajouter · Organisation</h3>
            </div>
            <div className="sc-grid">
                <label className="sc-col-2">
                    Nom*
                    <input name="name" required placeholder="Ex: Ericsson, Ooredoo, Orange..." />
                </label>
                <label>
                    Type*
                    <select name="type" defaultValue={ORG_TYPES[0]} required>
                        {ORG_TYPES.map((v) => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Pays
                    <input name="country" placeholder="Ex: Tunisia" />
                </label>
                <label className="sc-col-2">
                    Notes
                    <textarea name="notes" placeholder="Infos de contact, contexte, etc."></textarea>
                </label>
            </div>
            <div className="sc-actions">
                <button type="submit" className="sc-btn sc-primary">Ajouter</button>
            </div>
        </form>
    );

    /** ====== Contenu selon l’onglet ====== */
    const content = (() => {
        switch (active) {
            case "rackModels":
                return (
                    <>
                        {RackModelsList}
                        {RackModelForm}
                    </>
                );
            case "componentModels":
                return (
                    <>
                        {ComponentModelsList}
                        {ComponentModelForm}
                    </>
                );
            case "cableTypes":
                return (
                    <>
                        {CableTypesList}
                        {CableTypeForm}
                    </>
                );
            case "orgs":
                return (
                    <>
                        {OrgsList}
                        {OrgForm}
                    </>
                );
        }
    })();

    return (
        <div className="sc-wrap">
            {Title}
            {Tabs}
            {err && <div className="sc-error">{err}</div>}
            {loading ? <div className="sc-loading">Chargement…</div> : <div className="sc-content">{content}</div>}
        </div>
    );
}

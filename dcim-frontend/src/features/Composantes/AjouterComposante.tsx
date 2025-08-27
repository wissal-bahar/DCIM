import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./AjouterComposante.css";

function getAuthHeaders(base: HeadersInit = {}): HeadersInit {
    const token =
        localStorage.getItem("authToken") ??
        localStorage.getItem("token") ??
        localStorage.getItem("jwt") ??
        localStorage.getItem("dcim_token") ??
        null;
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

async function apiGet<T = unknown>(url: string): Promise<T> {
    const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" }),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => "API error"));
    return res.json() as Promise<T>;
}

async function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({
            "Content-Type": "application/json",
            Accept: "application/json",
        }),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        let msg = "API error";
        try {
            const j = (await res.json()) as { message?: string };
            if (j?.message) msg = j.message;
        } catch {}
        throw new Error(msg);
    }
    return res.json() as Promise<T>;
}

const API = {
    RACKS: "/api/racks",
    RACK_FREE_UNITS: (rackId: string | number) => `/api/racks/${rackId}/unites-libres`,
    PHYSICAL_MODELS: "/api/catalog/physical-models",
    COMPONENTS: "/api/components",
};

const STEPS = ["General", "Placement", "Model & Ports", "Description"] as const;

const COMPONENT_TYPES = [
    "serveur_rackable",
    "serveur_lame",
    "vMSC",
    "vCU",
    "vDU",
    "switch",
    "routeur",
    "firewall",
    "load_balancer",
    "dns_dhcp",
    "nas",
    "san",
    "controleur_stockage",
] as const;

const COMPONENT_STATUSES = ["actif", "inactif", "en_panne", "maintenance"] as const;
const LAYERS = ["PHYSICAL", "LOGICAL"] as const;
const RACK_SIDES = ["LEFT", "RIGHT", "FRONT", "REAR", "TOP"] as const;

const COLOR_PALETTE = [
    "#ffffff",
    "#D32F2F",
    "#FFA726",
    "#FFEE58",
    "#374151",
    "#111827",
    "#A5D6A7",
    "#4DB6AC",
    "#26C6DA",
    "#60a5fa",
    "#8b5cf6",
    "#ec4899",
];

type RackLight = { id: number; nom: string };
type UniteLight = { id: number; numero: number };
type ModelLight = { id: string; vendor: string; model: string; function: string };

type FormShape = {
    nom: string;
    type: (typeof COMPONENT_TYPES)[number] | "";
    statut: (typeof COMPONENT_STATUSES)[number] | "";
    layer: (typeof LAYERS)[number];
    color: string;
    rackId: string;
    uniteId: string;
    rackSide: (typeof RACK_SIDES)[number] | "";
    modelId: string;
    modele: string;
    numeroserie: string;
    description: string;
};

type Props = {
    open?: boolean;
    onClose?: () => void;
    onCreated?: (created?: unknown) => void;
    embed?: boolean;
    variant?: "drawer" | "modal";
};

export default function AjouterComposante(props: Props) {
    const navigate = useNavigate();
    const { rackId: rackIdFromRoute } = useParams();
    const isLockedToRack = !!rackIdFromRoute;

    const { open = true, onClose, onCreated, embed, variant = "drawer" } = props;

    const isEmbed = !!embed;

    const [stepIdx, setStepIdx] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [racks, setRacks] = useState<RackLight[]>([]);
    const [unites, setUnites] = useState<UniteLight[]>([]);
    const [models, setModels] = useState<ModelLight[]>([]);

    const [form, setForm] = useState<FormShape>({
        nom: "",
        type: "",
        statut: "",
        layer: "PHYSICAL",
        color: "",
        rackId: rackIdFromRoute ?? "",
        uniteId: "",
        rackSide: "",
        modelId: "",
        modele: "",
        numeroserie: "",
        description: "",
    });

    useEffect(() => {
        if (!isLockedToRack) {
            apiGet<RackLight[]>(API.RACKS).then(setRacks).catch(() => setRacks([]));
        }
    }, [isLockedToRack]);

    useEffect(() => {
        const rid = isLockedToRack ? rackIdFromRoute : form.rackId;
        if (!rid) {
            setUnites([]);
            return;
        }
        apiGet<UniteLight[]>(API.RACK_FREE_UNITS(rid)).then(setUnites).catch(() => setUnites([]));
    }, [isLockedToRack, rackIdFromRoute, form.rackId]);

    useEffect(() => {
        apiGet<ModelLight[]>(API.PHYSICAL_MODELS).then(setModels).catch(() => setModels([]));
    }, []);

    const canGoPrev = stepIdx > 0;
    const isLast = stepIdx === STEPS.length - 1;

    const requiredErrors = useMemo(() => {
        const e: Partial<Record<keyof FormShape, string>> = {};
        if (stepIdx === 0) {
            if (!form.nom.trim()) e.nom = "Name is required.";
            if (!form.type) e.type = "Type is required.";
            if (!form.statut) e.statut = "Status is required.";
        }
        if (stepIdx === 1) {
            if (!(isLockedToRack || form.rackId)) e.rackId = "Select a rack.";
            if (!form.uniteId) e.uniteId = "Select a unit.";
        }
        return e;
    }, [form, stepIdx, isLockedToRack]);

    function update<K extends keyof FormShape>(key: K, val: FormShape[K]) {
        setForm((f) => ({ ...f, [key]: val }));
    }

    async function onNext(e: FormEvent) {
        e.preventDefault();
        setError(null);
        if (Object.keys(requiredErrors).length > 0) return;
        if (!isLast) setStepIdx((i) => i + 1);
        else await onSubmit();
    }

    async function onSubmit() {
        try {
            setSubmitting(true);

            const payload = {
                nom: form.nom.trim(),
                type: form.type,
                statut: form.statut,
                layer: form.layer,
                color: form.color || null,
                rackSide: form.rackSide || null,
                rackId: (isLockedToRack ? rackIdFromRoute : form.rackId)
                    ? Number(isLockedToRack ? rackIdFromRoute : form.rackId)
                    : null,
                uniteId: form.uniteId ? Number(form.uniteId) : null,
                modelId: form.modelId || null,
                modele: form.modele || "",
                numeroserie: form.numeroserie || "",
                description: form.description || null,
            };

            const created = await apiPost(API.COMPONENTS, payload);
            onCreated?.(created);

            const rid = isLockedToRack ? rackIdFromRoute : form.rackId;
            if (rid) navigate(`/rack/${rid}`, { replace: true });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setSubmitting(false);
        }
    }

    const body = (
        <>
            <nav className="add-steps">
                {STEPS.map((label, i) => (
                    <div key={label} className={`step ${i === stepIdx ? "active" : i < stepIdx ? "done" : ""}`}>
                        <span className="dot">{i + 1}</span>
                        <span className="label">{label}</span>
                    </div>
                ))}
            </nav>

            <form className="add-body" onSubmit={onNext}>
                {error && <div className="form-error">{error}</div>}

                {stepIdx === 0 && (
                    <div className="step-grid">
                        <FieldText
                            label="Name"
                            required
                            value={form.nom}
                            onChange={(v) => update("nom", v)}
                            placeholder="e.g., Dell R740 #12"
                        />
                        <FieldSelect
                            label="Type"
                            required
                            value={form.type}
                            onChange={(v) => update("type", v as FormShape["type"])}
                            options={[{ label: "-- Select --", value: "" }, ...COMPONENT_TYPES.map((t) => ({ label: t, value: t }))]}
                        />
                        <FieldSelect
                            label="Status"
                            required
                            value={form.statut}
                            onChange={(v) => update("statut", v as FormShape["statut"])}
                            options={[{ label: "-- Select --", value: "" }, ...COMPONENT_STATUSES.map((s) => ({ label: s, value: s }))]}
                        />
                        <FieldSelect
                            label="Layer"
                            value={form.layer}
                            onChange={(v) => update("layer", v as FormShape["layer"])}
                            options={LAYERS.map((l) => ({ label: l, value: l }))}
                        />

                        <div className="form-row full">
                            <label>Color (optional)</label>
                            <div className="color-grid">
                                {COLOR_PALETTE.map((c) => (
                                    <button
                                        type="button"
                                        key={c}
                                        className={`color-square ${form.color === c ? "selected" : ""}`}
                                        style={{ background: c }}
                                        onClick={() => update("color", c)}
                                        aria-label={`Choose ${c}`}
                                        title={c}
                                    />
                                ))}
                                <button
                                    type="button"
                                    className={`color-square ${!form.color ? "selected" : ""}`}
                                    onClick={() => update("color", "")}
                                    title="No color"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {stepIdx === 1 && (
                    <div className="step-grid">
                        {!isLockedToRack ? (
                            <FieldSelect
                                label="Rack"
                                required
                                value={form.rackId}
                                onChange={(v) => update("rackId", v)}
                                options={[{ label: "-- Select --", value: "" }, ...racks.map((r) => ({ label: `${r.nom} (id:${r.id})`, value: String(r.id) }))]}
                            />
                        ) : (
                            <FieldText label="Rack (locked)" value={`#${rackIdFromRoute}`} onChange={() => {}} disabled />
                        )}

                        <FieldSelect
                            label="Unit"
                            required
                            value={form.uniteId}
                            onChange={(v) => update("uniteId", v)}
                            options={[{ label: "-- Select --", value: "" }, ...unites.map((u) => ({ label: `U${u.numero}`, value: String(u.id) }))]}
                        />

                        <FieldSelect
                            label="Rack side (optional)"
                            value={form.rackSide || ""}
                            onChange={(v) => update("rackSide", (v || "") as FormShape["rackSide"])}
                            options={[{ label: "—", value: "" }, ...RACK_SIDES.map((s) => ({ label: s, value: s }))]}
                        />
                    </div>
                )}

                {stepIdx === 2 && (
                    <div className="step-grid">
                        <FieldSelect
                            label="Manufacturer model (catalog)"
                            value={form.modelId}
                            onChange={(v) => update("modelId", v)}
                            options={[
                                { label: "—", value: "" },
                                ...models.map((m) => ({
                                    label: `${m.vendor} ${m.model} (${m.function})`,
                                    value: m.id,
                                })),
                            ]}
                            full
                        />
                    </div>
                )}

                {stepIdx === 3 && (
                    <div className="step-grid">
                        <FieldText
                            label="Model (free text)"
                            value={form.modele}
                            onChange={(v) => update("modele", v)}
                            placeholder="e.g., PowerEdge R740"
                        />
                        <FieldText
                            label="Serial number"
                            value={form.numeroserie}
                            onChange={(v) => update("numeroserie", v)}
                            placeholder="e.g., SN123456"
                        />
                        <FieldTextarea label="Description" value={form.description} onChange={(v) => update("description", v)} full />
                    </div>
                )}

                <footer className="add-actions">
                    {onClose && (
                        <button type="button" className="chip" onClick={onClose} disabled={submitting}>
                            Cancel
                        </button>
                    )}
                    <div className="spacer" />
                    {canGoPrev && (
                        <button type="button" className="chip" onClick={() => setStepIdx((i) => i - 1)} disabled={submitting}>
                            Previous
                        </button>
                    )}
                    <button className="add-btn" disabled={submitting || Object.keys(requiredErrors).length > 0}>
                        {submitting ? "Sending…" : isLast ? "Add" : "Next"}
                    </button>
                </footer>
            </form>
        </>
    );

    if (isEmbed) return body;
    if (!open) return null;

    if (variant === "modal") {
        return (
            <div className="dcim-modal" role="dialog" aria-modal="true">
                <div className="dcim-modal-panel">
                    <header className="add-head">
                        <h2>Add Component</h2>
                        {onClose && (
                            <button className="icon-btn" onClick={onClose} aria-label="Close">
                                ✕
                            </button>
                        )}
                    </header>
                    {body}
                </div>
            </div>
        );
    }

    return (
        <div className={`dcim-add-drawer ${open ? "open" : ""}`} role="dialog" aria-modal="true">
            <div className="dcim-add-panel">
                <header className="add-head">
                    <h2>Add Component</h2>
                    {onClose && (
                        <button className="icon-btn" onClick={onClose} aria-label="Close">
                            ✕
                        </button>
                    )}
                </header>
                {body}
            </div>
        </div>
    );
}

function FieldText(props: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    required?: boolean;
    error?: string;
    full?: boolean;
    disabled?: boolean;
}) {
    const { label, value, onChange, placeholder, required, error, full, disabled } = props;
    return (
        <div className={`form-row ${full ? "full" : ""}`}>
            <label>
                {label}
                {required && <span className="req"> *</span>}
            </label>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
            {error && <div className="field-err">{error}</div>}
        </div>
    );
}

function FieldTextarea(props: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    required?: boolean;
    error?: string;
    full?: boolean;
}) {
    const { label, value, onChange, placeholder, required, error, full } = props;
    return (
        <div className={`form-row ${full ? "full" : ""}`}>
            <label>
                {label}
                {required && <span className="req"> *</span>}
            </label>
            <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            {error && <div className="field-err">{error}</div>}
        </div>
    );
}

function FieldSelect(props: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { label: string; value: string }[];
    required?: boolean;
    error?: string;
    full?: boolean;
}) {
    const { label, value, onChange, options, required, error, full } = props;
    return (
        <div className={`form-row ${full ? "full" : ""}`}>
            <label>
                {label}
                {required && <span className="req"> *</span>}
            </label>
            <select value={value} onChange={(e) => onChange(e.target.value)}>
                {options.map((o) => (
                    <option key={`${o.value}-${o.label}`} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            {error && <div className="field-err">{error}</div>}
        </div>
    );
}

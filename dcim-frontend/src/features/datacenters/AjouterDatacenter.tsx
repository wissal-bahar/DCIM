import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./AjouterDatacenter.css";

function pickDatacenterId(resp: unknown): string | null {
    if (resp && typeof resp === "object") {
        const r = resp as Record<string, unknown>;
        if (typeof r.id === "string") return r.id;
        const dc = r.datacenter;
        if (dc && typeof dc === "object") {
            const id = (dc as Record<string, unknown>).id;
            if (typeof id === "string") return id;
        }
    }
    return null;
}

function getAuthHeaders(base: HeadersInit = {}): HeadersInit {
    const token =
        localStorage.getItem("authToken") ??
        localStorage.getItem("token") ??
        localStorage.getItem("jwt") ??
        localStorage.getItem("dcim_token") ??
        null;
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

type Props = {
    open?: boolean;
    onClose: () => void;
    onCreated?: (created?: unknown) => void;
    onSaved?: (updated?: unknown) => void;
    embed?: boolean;
    mode?: "add" | "edit";
    initial?: Partial<DCInput> & { id?: string };
};

type DCInput = {
    name: string;
    client: string;
    siteName: string;
    address: string;
    visitDate: string;
    acVoltage: string;
    phases: string;
    frequency: string;
    groundingType: string;
    powerPlant: boolean;
    coolingType: string;
    coolingUnits: string;
    hasGenerator: boolean;
    hasFireExt: boolean;
    hasEmergencyLight: boolean;
    hasSecurity: boolean;
    hasToilets: boolean;
    planUrl: string;
    gridRows: string;
    gridCols: string;
    gridCellSizeMm: string;
};

const REQUIRED: Array<keyof DCInput> = ["name", "siteName", "address", "client"];

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
        const j = (await res.json().catch(() => undefined)) as unknown;
        let msg = "API error";
        if (j && typeof j === "object" && "message" in j && typeof (j as { message?: unknown }).message === "string") {
            msg = (j as { message: string }).message;
        }
        throw new Error(msg);
    }
    return res.json() as Promise<T>;
}

async function apiPut<T = unknown>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders({
            "Content-Type": "application/json",
            Accept: "application/json",
        }),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const j = (await res.json().catch(() => undefined)) as unknown;
        let msg = "API error";
        if (j && typeof j === "object" && "message" in j && typeof (j as { message?: unknown }).message === "string") {
            msg = (j as { message: string }).message;
        }
        throw new Error(msg);
    }
    return res.json() as Promise<T>;
}

const STEPS = ["General", "Electrical", "Cooling", "Security & Facilities", "Plan & Grid"] as const;

export default function AjouterDatacenter(props: Props) {
    const navigate = useNavigate();

    const { open, onClose, onCreated, onSaved, embed, mode = "add", initial } = props;
    const isEmbed = !!embed;

    const [stepIdx, setStepIdx] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<DCInput>({
        name: "",
        client: "",
        siteName: "",
        address: "",
        visitDate: "",
        acVoltage: "",
        phases: "",
        frequency: "",
        groundingType: "",
        powerPlant: false,
        coolingType: "",
        coolingUnits: "",
        hasGenerator: false,
        hasFireExt: false,
        hasEmergencyLight: false,
        hasSecurity: false,
        hasToilets: false,
        planUrl: "",
        gridRows: "",
        gridCols: "",
        gridCellSizeMm: "",
    });

    useEffect(() => {
        if (!open && !isEmbed) {
            setStepIdx(0);
            setSubmitting(false);
            setError(null);
            setForm({
                name: "",
                client: "",
                siteName: "",
                address: "",
                visitDate: "",
                acVoltage: "",
                phases: "",
                frequency: "",
                groundingType: "",
                powerPlant: false,
                coolingType: "",
                coolingUnits: "",
                hasGenerator: false,
                hasFireExt: false,
                hasEmergencyLight: false,
                hasSecurity: false,
                hasToilets: false,
                planUrl: "",
                gridRows: "",
                gridCols: "",
                gridCellSizeMm: "",
            });
        }
    }, [open, isEmbed]);

    useEffect(() => {
        if (!isEmbed && !open) return;
        if (mode !== "edit" || !initial) return;

        setStepIdx(0);
        setError(null);
        setForm((f) => ({
            ...f,
            name: initial.name ?? "",
            client: initial.client ?? "",
            siteName: initial.siteName ?? "",
            address: initial.address ?? "",
            visitDate: initial.visitDate ?? "",
            acVoltage: initial.acVoltage ?? "",
            phases: initial.phases ?? "",
            frequency: initial.frequency ?? "",
            groundingType: initial.groundingType ?? "",
            powerPlant: !!initial.powerPlant,
            coolingType: initial.coolingType ?? "",
            coolingUnits: initial.coolingUnits ?? "",
            hasGenerator: !!initial.hasGenerator,
            hasFireExt: !!initial.hasFireExt,
            hasEmergencyLight: !!initial.hasEmergencyLight,
            hasSecurity: !!initial.hasSecurity,
            hasToilets: !!initial.hasToilets,
            planUrl: initial.planUrl ?? "",
            gridRows: initial.gridRows ?? "",
            gridCols: initial.gridCols ?? "",
            gridCellSizeMm: initial.gridCellSizeMm ?? "",
        }));
    }, [open, isEmbed, mode, initial]);

    const canGoPrev = stepIdx > 0;
    const isLast = stepIdx === STEPS.length - 1;

    const requiredErrors = useMemo(() => {
        const errs: Partial<Record<keyof DCInput, string>> = {};
        if (stepIdx === 0) {
            REQUIRED.forEach((k) => {
                const v = (form[k] ?? "") as string;
                if (!String(v).trim()) errs[k] = "This field is required.";
            });
        }
        return errs;
    }, [form, stepIdx]);

    function update<K extends keyof DCInput>(key: K, val: DCInput[K]) {
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
                name: form.name.trim(),
                client: form.client.trim(),
                siteName: form.siteName.trim(),
                address: form.address.trim(),
                visitDate: form.visitDate || null,
                acVoltage: form.acVoltage || null,
                phases: form.phases || null,
                frequency: form.frequency ? Number(form.frequency) : null,
                groundingType: form.groundingType || null,
                powerPlant: !!form.powerPlant,
                coolingType: form.coolingType || null,
                coolingUnits: form.coolingUnits ? Number(form.coolingUnits) : null,
                hasGenerator: !!form.hasGenerator,
                hasFireExt: !!form.hasFireExt,
                hasEmergencyLight: !!form.hasEmergencyLight,
                hasSecurity: !!form.hasSecurity,
                hasToilets: !!form.hasToilets,
                planUrl: form.planUrl || null,
                gridRows: form.gridRows ? Number(form.gridRows) : null,
                gridCols: form.gridCols ? Number(form.gridCols) : null,
                gridCellSizeMm: form.gridCellSizeMm ? Number(form.gridCellSizeMm) : null,
            };

            if (mode === "edit" && initial?.id) {
                const updated = await apiPut(`/api/datacenters/${initial.id}`, payload);
                onSaved?.(updated);
            } else {
                const created = await apiPost("/api/datacenters", payload);
                onCreated?.(created);

                const dcId = pickDatacenterId(created);
                if (!dcId) {
                    setSubmitting(false);
                    setError("Unexpected response: missing id");
                    return;
                }

                navigate(`/datacenters/${dcId}/plan/edit`, { replace: true });
            }
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
                        <FieldText label="Name" required value={form.name} onChange={(v) => update("name", v)} placeholder="e.g., DC Sousse" />
                        <FieldText label="Client" value={form.client} onChange={(v) => update("client", v)} placeholder="e.g., Ericsson" />
                        <FieldText label="Site name" required value={form.siteName} onChange={(v) => update("siteName", v)} placeholder="e.g., SOU-1" />
                        <FieldText label="Address" required value={form.address} onChange={(v) => update("address", v)} placeholder="e.g., Sousse, Tunisia" full />
                        <FieldDate label="Visit date" value={form.visitDate} onChange={(v) => update("visitDate", v)} placeholder="dd/mm/yyyy" full />
                    </div>
                )}

                {stepIdx === 1 && (
                    <div className="step-grid">
                        <FieldText label="AC Voltage" value={form.acVoltage} onChange={(v) => update("acVoltage", v)} placeholder="e.g., 230V" />
                        <FieldText label="Phases" value={form.phases} onChange={(v) => update("phases", v)} placeholder="e.g., 1P/3P" />
                        <FieldNumber label="Frequency (Hz)" value={form.frequency} onChange={(v) => update("frequency", v)} placeholder="50" />
                        <FieldText label="Grounding type" value={form.groundingType} onChange={(v) => update("groundingType", v)} placeholder="e.g., TT/TN/IT" />
                        <FieldSwitch label="On-site power plant" checked={form.powerPlant} onChange={(v) => update("powerPlant", v)} full />
                    </div>
                )}

                {stepIdx === 2 && (
                    <div className="step-grid">
                        <FieldText label="Cooling type" value={form.coolingType} onChange={(v) => update("coolingType", v)} placeholder="e.g., InRow, Free cooling..." />
                        <FieldNumber label="Cooling units" value={form.coolingUnits} onChange={(v) => update("coolingUnits", v)} placeholder="0" />
                    </div>
                )}

                {stepIdx === 3 && (
                    <div className="step-grid">
                        <FieldSwitch label="Generator" checked={form.hasGenerator} onChange={(v) => update("hasGenerator", v)} />
                        <FieldSwitch label="Fire extinguishers" checked={form.hasFireExt} onChange={(v) => update("hasFireExt", v)} />
                        <FieldSwitch label="Emergency lighting" checked={form.hasEmergencyLight} onChange={(v) => update("hasEmergencyLight", v)} />
                        <FieldSwitch label="Security (guards/CCTV)" checked={form.hasSecurity} onChange={(v) => update("hasSecurity", v)} />
                        <FieldSwitch label="Toilets" checked={form.hasToilets} onChange={(v) => update("hasToilets", v)} />
                    </div>
                )}

                {stepIdx === 4 && (
                    <div className="step-grid">
                        <FieldText label="Plan URL" value={form.planUrl} onChange={(v) => update("planUrl", v)} placeholder="https://..." full />
                        <FieldNumber label="Rows (gridRows)" value={form.gridRows} onChange={(v) => update("gridRows", v)} />
                        <FieldNumber label="Columns (gridCols)" value={form.gridCols} onChange={(v) => update("gridCols", v)} />
                        <FieldNumber label="Cell size (mm)" value={form.gridCellSizeMm} onChange={(v) => update("gridCellSizeMm", v)} />
                    </div>
                )}

                <footer className="add-actions">
                    <button type="button" className="chip" onClick={onClose} disabled={submitting}>
                        Cancel
                    </button>
                    <div className="spacer" />
                    {canGoPrev && (
                        <button type="button" className="chip" onClick={() => setStepIdx((i) => i - 1)} disabled={submitting}>
                            Previous
                        </button>
                    )}
                    <button className="add-btn" disabled={submitting || Object.keys(requiredErrors).length > 0}>
                        {submitting ? "Sending…" : isLast ? (mode === "edit" ? "Save" : "Add") : "Next"}
                    </button>
                </footer>
            </form>
        </>
    );

    if (isEmbed) return body;
    if (!open) return null;

    return (
        <div className="dcim-drawer dcim-drawer-open" role="dialog" aria-modal="true">
            <div className="dcim-drawer-panel">
                <header className="drawer-head">
                    <h2>{mode === "edit" ? "Edit Datacenter" : "Add Datacenter"}</h2>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </header>
                {body}
            </div>
            <div className="dcim-drawer-backdrop" onClick={onClose} />
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
}) {
    const { label, value, onChange, placeholder, required, error, full } = props;
    return (
        <div className={`form-row ${full ? "full" : ""}`}>
            <label>
                {label}
                {required && <span className="req"> *</span>}
            </label>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            {error && <div className="field-err">{error}</div>}
        </div>
    );
}

function FieldNumber(props: {
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
            <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            {error && <div className="field-err">{error}</div>}
        </div>
    );
}

function FieldDate(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; full?: boolean }) {
    const { label, value, onChange, placeholder, full } = props;
    return (
        <div className={`form-row ${full ? "full" : ""}`}>
            <label>{label}</label>
            <input type="date" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        </div>
    );
}

function FieldSwitch(props: { label: string; checked: boolean; onChange: (v: boolean) => void; full?: boolean }) {
    const { label, checked, onChange, full } = props;
    return (
        <div className={`form-row switch ${full ? "full" : ""}`}>
            <label>{label}</label>
            <label className="switch-ui">
                <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
                <span className="slider" />
            </label>
        </div>
    );
}

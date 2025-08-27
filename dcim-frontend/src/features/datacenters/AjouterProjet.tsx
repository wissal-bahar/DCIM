import { type FormEvent, useEffect, useMemo, useState } from "react";
import "./AjouterProjet.css";

type Props = {
    open?: boolean;
    onClose: () => void;
    onCreated?: (created?: unknown) => void;
    onSaved?: (updated?: unknown) => void;
    embed?: boolean;
    mode?: "add" | "edit";
    initial?: Partial<ProjectInput> & { id?: string };
};

type DCOption = { id: string | number; name: string };
type OrgOption = { id: string | number; name: string };
type DatacenterRow = { id: string | number; name?: string; siteName?: string };
type OrganizationRow = { id: string | number; name?: string };

function unwrapItems<T>(res: T[] | { items: T[] } | { data: T[] } | unknown): T[] {
    if (Array.isArray(res)) return res;
    if (res && typeof res === "object") {
        if ("items" in res && Array.isArray((res as { items: unknown }).items)) return (res as { items: T[] }).items;
        if ("data" in res && Array.isArray((res as { data: unknown }).data)) return (res as { data: T[] }).data;
    }
    return [];
}

type ProjectInput = {
    name: string;
    code: string;
    description: string;
    status: "Planned" | "Active" | "Paused" | "Done";
    datacenterId: string;
    clientOrgId: string;
    startDate: string;
    endDate: string;
};

const STEPS = ["General", "Relations", "Planning"] as const;

async function apiPut<T = unknown>(url: string, body: unknown): Promise<T> {
    const token = localStorage.getItem("dcim_token") || "";
    const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const j = await res.json().catch(() => undefined as unknown);
        let msg = "API error";
        if (j && typeof j === "object" && "message" in j && typeof (j as { message?: unknown }).message === "string") {
            msg = (j as { message: string }).message;
        }
        throw new Error(msg);
    }
    return (await res.json()) as T;
}

async function apiGet<T = unknown>(url: string): Promise<T> {
    const token = localStorage.getItem("dcim_token") || "";
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

    if (!res.ok) {
        const j = await res.json().catch(() => undefined as unknown);
        let msg = "API error";
        if (j && typeof j === "object" && "message" in j && typeof (j as { message?: unknown }).message === "string") {
            msg = (j as { message: string }).message;
        }
        throw new Error(msg);
    }
    return (await res.json()) as T;
}

async function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
    const token = localStorage.getItem("dcim_token") || "";
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const j = await res.json().catch(() => undefined as unknown);
        let msg = "API error";
        if (j && typeof j === "object" && "message" in j && typeof (j as { message?: unknown }).message === "string") {
            msg = (j as { message: string }).message;
        }
        throw new Error(msg);
    }
    return (await res.json()) as T;
}

export default function AjouterProjet(props: Props) {
    const { open, onClose, onCreated, onSaved, embed, mode = "add", initial } = props;

    const isEmbed = !!embed;
    function toUiStatus(s?: string): ProjectInput["status"] {
        switch ((s || "").toUpperCase()) {
            case "IN_PROGRESS":
                return "Active";
            case "ON_HOLD":
                return "Paused";
            case "DONE":
                return "Done";
            case "CANCELLED":
                return "Planned";
            default:
                return "Planned";
        }
    }

    const [stepIdx, setStepIdx] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<ProjectInput>({
        name: "",
        code: "",
        description: "",
        status: "Planned",
        datacenterId: "",
        clientOrgId: "",
        startDate: "",
        endDate: "",
    });

    const [dcs, setDcs] = useState<DCOption[]>([]);
    const [orgs, setOrgs] = useState<OrgOption[]>([]);
    const [loadingRefs, setLoadingRefs] = useState(true);

    useEffect(() => {
        if (!open && !isEmbed) {
            setStepIdx(0);
            setSubmitting(false);
            setError(null);
            setForm({
                name: "",
                code: "",
                description: "",
                status: "Planned",
                datacenterId: "",
                clientOrgId: "",
                startDate: "",
                endDate: "",
            });
        }
    }, [open, isEmbed]);

    useEffect(() => {
        if (!open && !isEmbed) return;
        if (mode !== "edit" || !initial) return;

        setStepIdx(0);
        setForm({
            name: initial.name ?? "",
            code: initial.code ?? "",
            description: initial.description ?? "",
            status: initial.status ? toUiStatus(String(initial.status)) : "Planned",
            datacenterId: initial.datacenterId ?? "",
            clientOrgId: initial.clientOrgId ?? "",
            startDate: (initial.startDate as string) ?? "",
            endDate: (initial.endDate as string) ?? "",
        });
    }, [open, isEmbed, mode, initial]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoadingRefs(true);

                const [dcRes, orgRes] = await Promise.all([
                    apiGet<DatacenterRow[] | { items: DatacenterRow[] }>("/api/datacenters"),
                    apiGet<OrganizationRow[] | { items: OrganizationRow[] }>("/api/organizations").catch(
                        () => [] as OrganizationRow[] | { items: OrganizationRow[] }
                    ),
                ]);

                if (!alive) return;

                const dcOpts: DCOption[] = unwrapItems<DatacenterRow>(dcRes).map((d) => ({
                    id: d.id,
                    name: d.name ?? d.siteName ?? String(d.id),
                }));
                const orgOpts: OrgOption[] = unwrapItems<OrganizationRow>(orgRes).map((o) => ({
                    id: o.id,
                    name: o.name ?? String(o.id),
                }));

                setDcs(dcOpts);
                setOrgs(orgOpts);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Reference loading error");
            } finally {
                setLoadingRefs(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    const canGoPrev = stepIdx > 0;
    const isLast = stepIdx === STEPS.length - 1;

    const requiredErrors = useMemo(() => {
        const errs: Partial<Record<keyof ProjectInput, string>> = {};
        if (stepIdx === 0) {
            if (!form.name.trim()) errs.name = "This field is required.";
        }
        if (stepIdx === 1) {
            if (!form.datacenterId) errs.datacenterId = "Select a datacenter.";
        }
        if (stepIdx === 2) {
            if (form.startDate && form.endDate) {
                if (new Date(form.endDate).getTime() < new Date(form.startDate).getTime()) {
                    errs.endDate = "End date must be later than start date.";
                }
            }
        }
        return errs;
    }, [form, stepIdx]);

    function update<K extends keyof ProjectInput>(key: K, val: ProjectInput[K]) {
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
                code: form.code?.trim() || null,
                description: form.description?.trim() || null,
                status: form.status,
                datacenterId: form.datacenterId || null,
                clientOrgId: form.clientOrgId || null,
                startDate: form.startDate || null,
                endDate: form.endDate || null,
            };

            if (mode === "edit" && initial?.id) {
                const updated = await apiPut(`/api/projects/${initial.id}`, payload);
                onSaved?.(updated);
            } else {
                const created = await apiPost("/api/projects", payload);
                onCreated?.(created);
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
                        <FieldText label="Name *" value={form.name} onChange={(v) => update("name", v)} placeholder="e.g., NFVi Migration v2" error={requiredErrors.name} />
                        <FieldText label="Code" value={form.code} onChange={(v) => update("code", v)} placeholder="e.g., NFV-2025-01" />
                        <FieldSelect
                            label="Status"
                            value={form.status}
                            onChange={(v) => update("status", v as ProjectInput["status"])}
                            options={[
                                { value: "Planned", label: "Planned" },
                                { value: "Active", label: "Active" },
                                { value: "Paused", label: "Paused" },
                                { value: "Done", label: "Done" },
                            ]}
                            full
                        />
                        <FieldTextarea label="Description" value={form.description} onChange={(v) => update("description", v)} placeholder="Short description (optional)..." full />
                    </div>
                )}

                {stepIdx === 1 && (
                    <div className="step-grid">
                        <FieldSelect
                            label="Datacenter *"
                            value={form.datacenterId}
                            onChange={(v) => update("datacenterId", v)}
                            options={[{ value: "", label: loadingRefs ? "Loading…" : "Select" }, ...dcs.map((d) => ({ value: String(d.id), label: d.name }))]}
                            error={requiredErrors.datacenterId}
                        />
                        <FieldSelect
                            label="Client organization"
                            value={form.clientOrgId}
                            onChange={(v) => update("clientOrgId", v)}
                            options={[{ value: "", label: loadingRefs ? "Loading…" : "None" }, ...orgs.map((o) => ({ value: String(o.id), label: o.name }))]}
                        />
                    </div>
                )}

                {stepIdx === 2 && (
                    <div className="step-grid">
                        <FieldDate label="Start" value={form.startDate} onChange={(v) => update("startDate", v)} />
                        <FieldDate label="End" value={form.endDate} onChange={(v) => update("endDate", v)} error={requiredErrors.endDate} />
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
                    <h2>{mode === "edit" ? "Edit Project" : "Add Project"}</h2>
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

function FieldText(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string; full?: boolean }) {
    const { label, value, onChange, placeholder, error, full } = props;
    return (
        <div className={`form-row ${full ? "full" : ""}`}>
            <label>{label}</label>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            {error && <div className="field-err">{error}</div>}
        </div>
    );
}

function FieldTextarea(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; full?: boolean }) {
    const { label, value, onChange, placeholder, full } = props;
    return (
        <div className={`form-row ${full ? "full" : ""}`}>
            <label>{label}</label>
            <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} />
        </div>
    );
}

function FieldSelect(props: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; error?: string; full?: boolean }) {
    const { label, value, onChange, options, error, full } = props;
    return (
        <div className={`form-row ${full ? "full" : ""}`}>
            <label>{label}</label>
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

function FieldDate(props: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
    const { label, value, onChange, error } = props;
    return (
        <div className="form-row">
            <label>{label}</label>
            <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
            {error && <div className="field-err">{error}</div>}
        </div>
    );
}

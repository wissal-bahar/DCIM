// src/pages/LoginPage.tsx
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import background from "../../assets/images/background.png";

type Step = "email" | "otp" | "unauthorized";

/* ========= Types d'API & garde-types ========= */
type RequestAuthResponse = { status: "otp_sent" | "unauthorized"; message?: string };
type LoginResponse = { token?: string; message?: string };
type AccessRequestResponse = { ok?: boolean; message?: string; error?: string };

function isRequestAuthResponse(v: unknown): v is RequestAuthResponse {
    return (
        typeof v === "object" &&
        v !== null &&
        "status" in v &&
        (v as { status: unknown }).status !== undefined
    );
}
function isLoginResponse(v: unknown): v is LoginResponse {
    return typeof v === "object" && v !== null;
}
function isAccessReqResponse(v: unknown): v is AccessRequestResponse {
    return typeof v === "object" && v !== null;
}
function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    try {
        return JSON.stringify(err);
    } catch {
        return "Une erreur est survenue";
    }
}

export default function LoginPage() {
    const navigate = useNavigate();

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [appealMsg, setAppealMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    // ---------------------------------------------------------------------------
    // Étape 4 : demander un OTP
    // ---------------------------------------------------------------------------
    const requestAuth = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setInfo(null);
        setLoading(true);
        try {
            const res = await fetch("/api/auth/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data: unknown = await res.json();
            if (!res.ok) {
                const msg =
                    (typeof data === "object" && data && "message" in data && String((data as { message?: unknown }).message)) ||
                    "Erreur serveur";
                throw new Error(msg);
            }

            if (isRequestAuthResponse(data)) {
                if (data.status === "otp_sent") {
                    setStep("otp");
                    setInfo("Un code à 6 chiffres vous a été envoyé par email.");
                } else if (data.status === "unauthorized") {
                    setStep("unauthorized");
                    setInfo(null);
                } else {
                    throw new Error("Réponse inconnue");
                }
            } else {
                throw new Error("Format de réponse invalide");
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    // ---------------------------------------------------------------------------
    // Étape 5 : vérifier l’OTP et naviguer + stocker le JWT
    // ---------------------------------------------------------------------------
    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setInfo(null);

        const code = otp.trim();
        if (!/^\d{6}$/.test(code)) {
            setError("Le code doit contenir 6 chiffres.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code }),
            });

            const data: unknown = await res.json();
            if (!res.ok) {
                const msg =
                    (typeof data === "object" && data && "message" in data && String((data as { message?: unknown }).message)) ||
                    "Code invalide";
                throw new Error(msg);
            }

            if (isLoginResponse(data) && "token" in data && typeof (data as { token?: unknown }).token === "string") {
                localStorage.setItem("dcim_token", String((data as { token: string }).token));
            }
            localStorage.setItem("dcim_email", email);
            navigate("/datacenters");
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    // ---------------------------------------------------------------------------
    // Étape 6 : envoyer une demande d’accès (si non autorisé)
    // ---------------------------------------------------------------------------
    const sendAccessRequest = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setInfo(null);

        const msg = appealMsg.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setError("Veuillez saisir un email valide.");
            return;
        }
        if (!msg) {
            setError("Merci de décrire votre demande.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/access-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: normalizedEmail, message: msg }),
            });

            const data: unknown = await res.json();
            if (!res.ok) {
                const errMsg =
                    (isAccessReqResponse(data) && (data.error || data.message)) || "Erreur lors de l’envoi";
                throw new Error(errMsg);
            }

            setInfo("Votre demande a bien été envoyée ✅");
            setAppealMsg("");
        } catch (err: unknown) {
            setError(getErrorMessage(err) || "Impossible d’envoyer la demande");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="login">
            <div className="login-bg" style={{ backgroundImage: `url(${background})` }} />
            <div className="login-overlay" />

            <section className="login-card" role="dialog" aria-label="Authentification">
                <h1 className="login-title">Login</h1>

                {/* Étape 1 : Email */}
                {step === "email" && (
                    <form className="login-form" onSubmit={requestAuth}>
                        <label className="field">
              <span className="icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.6" />
                  <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </label>

                        <button className="btn-primary" type="submit" disabled={loading || !email}>
                            {loading ? "Sending..." : "Send authorization"}
                        </button>

                        {error && <p className="meta" style={{ color: "#d538dc" }}>{error}</p>}
                        {info && <p className="meta">{info}</p>}
                    </form>
                )}

                {/* Étape 2 : OTP */}
                {step === "otp" && (
                    <form className="login-form" onSubmit={handleLogin}>
                        <label className="field">
              <span className="icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M8 10V7a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="Code à 6 chiffres"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                                maxLength={6}
                            />
                        </label>

                        <button
                            className="btn-primary"
                            type="submit"
                            disabled={loading || !/^\d{6}$/.test(otp)}
                        >
                            {loading ? "Vérification..." : "Se connecter"}
                        </button>

                        {error && <p className="meta" style={{ color: "#d538dc" }}>{error}</p>}
                        {info && <p className="meta">{info}</p>}
                    </form>
                )}

                {/* Étape 3 : Non autorisé → envoi d’une demande d’accès */}
                {step === "unauthorized" && (
                    <form className="login-form" onSubmit={sendAccessRequest}>
                        <p className="meta">You are an unauthorized person, request access...</p>

                        <label className="field" style={{ padding: "12px" }}>
              <textarea
                  placeholder="Expliquez votre demande d’accès (contexte, équipe, projet)…"
                  value={appealMsg}
                  onChange={(e) => setAppealMsg(e.target.value)}
                  rows={4}
                  style={{ width: "100%", background: "transparent", color: "var(--text)", border: "none", resize: "vertical" }}
                  required
              />
                        </label>

                        <button
                            className="btn-primary"
                            type="submit"
                            disabled={loading || appealMsg.trim().length === 0}
                        >
                            {loading ? "Sending..." : "Send Request"}
                        </button>

                        <p className="meta">Email address entered : <strong>{email}</strong></p>

                        {error && <p className="meta" style={{ color: "#d538dc" }}>{error}</p>}
                        {info && <p className="meta">{info}</p>}
                    </form>
                )}
            </section>
        </main>
    );
}

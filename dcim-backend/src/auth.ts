// src/auth.ts
import { Router, Request, Response, NextFunction } from "express";
import jwt, { Secret } from "jsonwebtoken";
import prisma from "./prisma";
import { sendOtpMail } from "./mailer";

export const authRouter = Router();

// ====== JWT utils ======
const JWT_SECRET: Secret = process.env.JWT_SECRET ?? "dev_secret_change_me";
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN ?? "2h";
const BEARER = "bearer ";

export interface AuthRequest extends Request {
    user?: { email: string };
}

export function signJwt(payload: object, expiresIn?: string | number) {
    return jwt.sign(
        payload,
        JWT_SECRET as string,
        { expiresIn: expiresIn ?? JWT_EXPIRES_IN } as jwt.SignOptions
    );
}


export function authRequired(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const auth = req.header("authorization") || "";
        if (!auth.toLowerCase().startsWith(BEARER)) {
            return res.status(401).json({ message: "Token manquant" });
        }
        const token = auth.slice(BEARER.length).trim();
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = { email: decoded.email };
        next();
    } catch {
        return res.status(401).json({ message: "Token invalide" });
    }
}

// ====== Helpers ======
function generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000)); // 6 chiffres
}

// ====== ROUTES ======

/**
 * POST /api/auth/request
 * Body: { email }
 * - Vérifie la whitelist
 * - Crée un OTP (10 min)
 * - Envoie l'OTP par email
 * - Réponses: {status:"otp_sent"} | {status:"unauthorized"}
 */
authRouter.post("/request", async (req, res) => {
    try {
        const { email } = req.body ?? {};
        if (!email || typeof email !== "string") {
            return res.status(400).json({ message: "Email requis" });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // whitelist
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { isAuthorized: true, email: true },
        });
        if (!user || !user.isAuthorized) {
            return res.json({ status: "unauthorized" });
        }

        // créer OTP
        const code = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        await prisma.otpCode.create({ data: { email: normalizedEmail, code, expiresAt } });

        // envoyer email
        try {
            await sendOtpMail(normalizedEmail, code);
            console.log(`OTP envoyé à ${normalizedEmail}: ${code}`);
        } catch (e) {
            console.error("Erreur envoi email:", e);
            return res.status(500).json({ message: "Échec d’envoi de l’email" });
        }

        return res.json({ status: "otp_sent" });
    } catch (err) {
        console.error("POST /api/auth/request error:", err);
        return res.status(500).json({ message: "Erreur serveur" });
    }
});

/**
 * POST /api/auth/login
 * Body: { email, code }
 * - Vérifie user autorisé
 * - Vérifie OTP (tentatives, expiration)
 * - Supprime OTP et renvoie { ok, token, user }
 */
authRouter.post("/login", async (req, res) => {
    try {
        const { email, code } = req.body ?? {};
        if (!email || !code) return res.status(400).json({ message: "Champs requis" });

        const normalizedEmail = String(email).trim().toLowerCase();
        const codeStr = String(code).trim();

        // autorisation
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { isAuthorized: true, email: true },
        });
        if (!user || !user.isAuthorized) {
            return res.status(401).json({ message: "Non autorisé" });
        }

        // dernier OTP
        const otp = await prisma.otpCode.findFirst({
            where: { email: normalizedEmail },
            orderBy: { createdAt: "desc" },
        });
        if (!otp) return res.status(401).json({ message: "Code invalide" });

        // limites
        if (otp.attempts >= 5) return res.status(429).json({ message: "Trop de tentatives" });
        const now = new Date();
        if (otp.expiresAt < now) {
            await prisma.otpCode.delete({ where: { id: otp.id } });
            return res.status(401).json({ message: "Code expiré" });
        }
        if (otp.code !== codeStr) {
            await prisma.otpCode.update({
                where: { id: otp.id },
                data: { attempts: { increment: 1 } },
            });
            return res.status(401).json({ message: "Code invalide" });
        }

        // succès : one-time ⇒ on supprime l’OTP et on signe un JWT
        await prisma.otpCode.delete({ where: { id: otp.id } });
        const token = signJwt({ email: user.email });

        return res.json({ ok: true, token, user: { email: user.email } });
    } catch (err) {
        console.error("POST /api/auth/login error:", err);
        return res.status(500).json({ message: "Erreur serveur" });
    }
});

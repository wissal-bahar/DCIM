import { Router } from "express";
import prisma from "../prisma";
import { authRequired } from "../auth"; // si tu protèges par JWT

export const datacentersRouter = Router();

// Créer un datacenter
datacentersRouter.post("/", authRequired, async (req, res) => {
    try {
        const b = req.body as {
            name: string;
            client?: string | null;
            siteName?: string | null;
            address?: string | null;
            visitDate?: string | null;

            acVoltage?: string | null;
            phases?: string | null;
            frequency?: number | null;
            groundingType?: string | null;
            powerPlant?: boolean;

            coolingType?: string | null;
            coolingUnits?: number | null;

            hasGenerator?: boolean;
            hasFireExt?: boolean;
            hasEmergencyLight?: boolean;
            hasSecurity?: boolean;
            hasToilets?: boolean;

            planUrl?: string | null;
            gridRows?: number | null;
            gridCols?: number | null;
            gridCellSizeMm?: number | null;
        };

        // validations simples (les mêmes "obligatoires" que dans le form)
        if (!b?.name?.trim()) {
            return res.status(400).json({ message: "Le nom est obligatoire." });
        }
        // client/siteName/address sont marqués requis dans ton form côté UI ;
        // ici on tolère vide mais on peut renforcer si tu veux strict pareil:
        // if (!b.client?.trim()) return res.status(400)...
        // if (!b.siteName?.trim()) ...
        // if (!b.address?.trim()) ...

        const data = {
            name: b.name.trim(),
            client: (b.client ?? "").toString().trim(),
            siteName: b.siteName?.toString().trim() || null,
            address: b.address?.toString().trim() || null,
            visitDate: b.visitDate ? new Date(b.visitDate) : null,

            acVoltage: b.acVoltage || null,
            phases: b.phases || null,
            frequency: b.frequency ?? null,
            groundingType: b.groundingType || null,
            powerPlant: !!b.powerPlant,

            coolingType: b.coolingType || null,
            coolingUnits: b.coolingUnits ?? null,

            hasGenerator: !!b.hasGenerator,
            hasFireExt: !!b.hasFireExt,
            hasEmergencyLight: !!b.hasEmergencyLight,
            hasSecurity: !!b.hasSecurity,
            hasToilets: !!b.hasToilets,

            planUrl: b.planUrl || null,
            gridRows: b.gridRows ?? null,
            gridCols: b.gridCols ?? null,
            gridCellSizeMm: b.gridCellSizeMm ?? null,
        };

        // Si "name" est unique et que tu veux empêcher les doublons:
        const existing = await prisma.datacenter.findUnique({ where: { name: data.name } });
        if (existing) {
            return res.status(409).json({ message: "Un datacenter avec ce nom existe déjà." });
        }

        const created = await prisma.datacenter.create({ data });
        return res.status(201).json(created);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Erreur serveur." });
    }
});

// (optionnel) Liste pour tester rapidement
datacentersRouter.get("/", authRequired, async (_req, res) => {
    const list = await prisma.datacenter.findMany({ orderBy: { createdAt: "desc" } });
    res.json(list);
});

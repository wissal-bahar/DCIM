// src/index.ts
import express, { Router } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import prisma from "./prisma";
import { authRouter, authRequired } from "./auth";
import { ProjectStatus, SiteAssetKind, Prisma, RequestStatus } from "@prisma/client";

import type {
    Request,
    Response,
    NextFunction,
    RequestHandler,
} from "express";

const app = express();
const PORT = 3000;

/* ----------------------------
   CORS + Cookies (important)
-----------------------------*/
const corsOptions: cors.CorsOptions = {
    origin: true, // ou "http://localhost:5173"
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options(/\/api\/.*/, cors(corsOptions));   // ✔ Express 5
 // ✔ Express 5
 // ✔ si tu ne veux gérer que /api
 // laisse passer les pré-vols
app.use(cookieParser());

app.use(express.json({ limit: "2mb" }));
app.use("/api/auth", authRouter);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
type AsyncFn = (req: Request, res: Response, next: NextFunction) => any;

const asyncHandler = (fn: AsyncFn): RequestHandler =>
    (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const toInt = (v: unknown, def: number) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : def;
};
function parseSiteAssetKind(v: unknown): SiteAssetKind {
    if (typeof v !== "string") throw new Error("kind must be a string");

    // normalise: "door" -> "DOOR", "Cooling" -> "COOLING", etc.
    const norm = v.trim().toUpperCase();

    // (optionnel) quelques alias FR/variantes si jamais
    const alias: Record<string, SiteAssetKind> = {
        PORTE: SiteAssetKind.DOOR,
        FROID: SiteAssetKind.COOLING,
        COLONNE: SiteAssetKind.COLUMN,
        AUTRE: SiteAssetKind.OTHER,
    };

    if ((norm as keyof typeof SiteAssetKind) in SiteAssetKind) {
        return norm as SiteAssetKind;
    }
    if (norm in alias) {
        return alias[norm];
    }

    throw new Error(`Invalid SiteAssetKind: ${v}`);
}


// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------
app.get("/", (_req, res) => {
    res.send("Bienvenue dans le backend DCIM !");
});

// -----------------------------------------------------------------------------
// Access Requests (Étape 6)
// -----------------------------------------------------------------------------

// POST /api/access-requests  { email, message }  (PUBLIC)
app.post("/api/access-requests", asyncHandler(async (req: Request, res: Response) => {
    const { email, message } = req.body ?? {};
    if (!email || !message) {
        return res.status(400).json({ error: "email et message sont requis." });
    }
    const created = await prisma.accessRequest.create({
        data: { email, message },
    });
    res.status(201).json({ ok: true, id: created.id });
}));

// GET /api/access-requests (ADMIN)
app.get("/api/access-requests", authRequired, asyncHandler(async (_req: Request, res: Response) => {
    const items = await prisma.accessRequest.findMany({
        orderBy: { createdAt: "desc" },
    });
    res.json(items);
}));

// PATCH /api/access-requests/:id (changer le statut) (ADMIN)
app.patch(
    "/api/access-requests/:id",
    authRequired,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const body = req.body as { status?: RequestStatus };
        const newStatus = body.status ?? RequestStatus.APPROVED;

        const updated = await prisma.accessRequest.update({
            where: { id },
            data: {
                status: { set: newStatus },
                handledAt: { set: new Date() },
                handledBy: { set: (req as any).user?.id ?? null },
            } satisfies Prisma.AccessRequestUpdateInput,
        });

        res.json(updated);
    })
);

// -----------------------------------------------------------------------------
// Datacenters Router
// -----------------------------------------------------------------------------
const datacentersRouter = Router();
app.use("/api/datacenters", datacentersRouter);

// GET /api/datacenters?client=&q=&page=&pageSize=
datacentersRouter.get(
    "/",
    authRequired,
    asyncHandler(async (req, res) => {
        const { client, q } = req.query as { client?: string; q?: string };
        const page = toInt(req.query.page, 1);
        const pageSize = Math.min(Math.max(toInt(req.query.pageSize, 20), 1), 100);

        const where: any = {};
        if (client) where.client = { contains: client, mode: "insensitive" };
        if (q)
            where.OR = [
                { name: { contains: q, mode: "insensitive" } },
                { siteName: { contains: q, mode: "insensitive" } },
                { address: { contains: q, mode: "insensitive" } },
            ];

        const [total, items] = await Promise.all([
            prisma.datacenter.count({ where }),
            prisma.datacenter.findMany({
                where,
                orderBy: { name: "asc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    name: true,
                    client: true,
                    siteName: true,
                    address: true,
                    gridRows: true,
                    gridCols: true,
                    _count: { select: { racks: true, siteAssets: true, projects: true } },
                },
            }),
        ]);

        res.json({ total, page, pageSize, items });
    })
);

// GET /api/datacenters/:id (détails, racks légers + assets)
datacentersRouter.get(
    "/:id",
    authRequired,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const dc = await prisma.datacenter.findUnique({
            where: { id },
            include: {
                siteAssets: true,
                racks: {
                    orderBy: { nom: "asc" },
                    select: {
                        id: true,
                        nom: true,
                        posRow: true,
                        posCol: true,
                        rotationDeg: true,
                        datacenterId: true,
                    },
                },
                projects: { select: { id: true, name: true, status: true } },
            },
        });
        if (!dc) return res.status(404).json({ error: "Datacenter non trouvé" });
        res.json(dc);
    })
);

// GET /api/datacenters/:id/assets (portes, cooling, ODF, etc.)
datacentersRouter.get(
    "/:id/assets",
    authRequired,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const items = await prisma.siteAsset.findMany({
            where: { datacenterId: id },
            orderBy: [{ kind: "asc" }, { label: "asc" }],
        });
        res.json(items);
    })
);

// GET /api/datacenters
app.get("/api/datacenters", authRequired, async (req, res) => {
    const { search, client, city, country } = req.query as Record<string, string | undefined>;

    const where: any = {
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        ...(client && client !== "Tous" ? { client } : {}),
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
    };

    const dcs = await prisma.datacenter.findMany({
        where,
        include: { _count: { select: { racks: true, projects: true } } }, // ← important
        orderBy: { name: "asc" },
    });

    res.json(dcs);
});

app.post("/api/datacenters", authRequired, async (req, res) => {
    try {
        const b = req.body as any;

        if (!b?.name?.trim()) {
            return res.status(400).json({ message: "Le nom est obligatoire." });
        }

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

        const existing = await prisma.datacenter.findUnique({ where: { name: data.name } });
        if (existing) {
            return res.status(409).json({ message: "Un datacenter avec ce nom existe déjà." });
        }

        const created = await prisma.datacenter.create({ data });
        return res.status(201).json(created);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Erreur serveur." });
    }
});

// (optionnel) GET pour tester
app.get("/api/datacenters", authRequired, async (_req, res) => {
    const list = await prisma.datacenter.findMany({ orderBy: { createdAt: "desc" } });
    res.json(list);
});

// ⚠️ Tu avais déjà un app.listen() ici dans ta version originale.
// Je le laisse tel quel comme demandé (aucune suppression).
app.listen(PORT, () => {
    console.log(`API DCIM up on http://localhost:${PORT}`);
});

app.delete("/api/datacenters/:id", authRequired, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.datacenter.delete({ where: { id } });
        res.status(204).send(); // pas de contenu
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
            return res.status(409).json({ message: "Impossible de supprimer : des éléments y sont rattachés." });
        }
        console.error(e);
        res.status(500).json({ message: "Erreur serveur." });
    }
});

app.put("/api/datacenters/:id", authRequired, async (req, res) => {
    try {
        const { id } = req.params;
        const b = req.body as any;

        const data: Prisma.DatacenterUncheckedUpdateInput = {
            name: b.name?.trim(),
            client: b.client?.toString().trim() ?? undefined,
            siteName: b.siteName ?? undefined,
            address: b.address ?? undefined,
            visitDate: b.visitDate ? new Date(b.visitDate) : undefined,

            acVoltage: b.acVoltage ?? undefined,
            phases: b.phases ?? undefined,
            frequency: b.frequency ?? undefined,
            groundingType: b.groundingType ?? undefined,
            powerPlant: typeof b.powerPlant === "boolean" ? b.powerPlant : undefined,

            coolingType: b.coolingType ?? undefined,
            coolingUnits: b.coolingUnits ?? undefined,

            hasGenerator: typeof b.hasGenerator === "boolean" ? b.hasGenerator : undefined,
            hasFireExt: typeof b.hasFireExt === "boolean" ? b.hasFireExt : undefined,
            hasEmergencyLight: typeof b.hasEmergencyLight === "boolean" ? b.hasEmergencyLight : undefined,
            hasSecurity: typeof b.hasSecurity === "boolean" ? b.hasSecurity : undefined,
            hasToilets: typeof b.hasToilets === "boolean" ? b.hasToilets : undefined,

            planUrl: b.planUrl ?? undefined,
            gridRows: b.gridRows ?? undefined,
            gridCols: b.gridCols ?? undefined,
            gridCellSizeMm: b.gridCellSizeMm ?? undefined,
        };

        const updated = await prisma.datacenter.update({ where: { id }, data });
        res.json(updated);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur." });
    }
});

// OPTIONS explicite pour le pré-vol du bulk (utile si certains proxies sont tatillons)
datacentersRouter.options("/:id/plan/bulk", cors(corsOptions));

// POST /api/datacenters/:id/plan/bulk
datacentersRouter.post(
    "/:id/plan/bulk",
    authRequired,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { racks = [], assets = [], replace = false } = req.body as {
            replace?: boolean;
            racks?: Array<{
                id?: number;
                nom: string;
                posRow: number;
                posCol: number;
                rotationDeg?: number;
                nbUnites?: number;
                rackModelId?: string | null; // <<< STRING (uuid) dans ton schéma
                localisation?: string;
            }>;
            assets?: Array<{
                id?: string;
                kind: SiteAssetKind | string; // viendra en string du front
                label?: string;
                posRow: number;
                posCol: number;
                spanRows?: number;
                spanCols?: number;
                rotationDeg?: number;
                notes?: string;
            }>;
        };

        const dc = await prisma.datacenter.findUnique({ where: { id } });
        if (!dc) return res.status(404).json({ error: "Datacenter non trouvé" });

        const ops: any[] = [];

        // Optionnel : repartir de zéro pour les assets
        if (replace) {
            ops.push(prisma.siteAsset.deleteMany({ where: { datacenterId: id } }));
        }

        // Upsert assets
        for (const a of assets) {
            const safeKind = parseSiteAssetKind(a.kind);
            if (a.id) {
                ops.push(
                    prisma.siteAsset.update({
                        where: { id: a.id },
                        data: {
                            kind: { set: safeKind },
                            label: a.label ?? null,
                            posRow: a.posRow,
                            posCol: a.posCol,
                            spanRows: a.spanRows ?? 1,
                            spanCols: a.spanCols ?? 1,
                            rotationDeg: a.rotationDeg ?? 0,
                            notes: a.notes ?? null,
                        },
                    })
                );
            } else {
                ops.push(
                    prisma.siteAsset.create({
                        data: {
                            datacenterId: id,
                            kind: safeKind,
                            label: a.label ?? null,
                            posRow: a.posRow,
                            posCol: a.posCol,
                            spanRows: a.spanRows ?? 1,
                            spanCols: a.spanCols ?? 1,
                            rotationDeg: a.rotationDeg ?? 0,
                            notes: a.notes ?? null,
                        },
                    })
                );
            }
        }

        // Upsert racks
        for (const r of racks) {
            if (r.id) {
                ops.push(
                    prisma.rack.update({
                        where: { id: r.id },
                        data: {
                            nom: r.nom,
                            posRow: r.posRow,
                            posCol: r.posCol,
                            rotationDeg: r.rotationDeg ?? 0,
                            rackModelId: r.rackModelId ?? null,
                        },
                    })
                );
            } else {
                ops.push(
                    prisma.rack.create({
                        data: {
                            datacenterId: id,
                            nom: r.nom,
                            localisation: r.localisation ?? "",
                            nbUnites: r.nbUnites ?? 42,
                            posRow: r.posRow,
                            posCol: r.posCol,
                            rotationDeg: r.rotationDeg ?? 0,
                            rackModelId: r.rackModelId ?? null,
                        },
                    })
                );
            }
        }

        const results = await prisma.$transaction(ops);
        res.json({ ok: true, count: results.length });
    })
);

// -----------------------------------------------------------------------------
// Racks Router
// -----------------------------------------------------------------------------
const racksRouter = Router();

// GET /api/racks?datacenterId=&q=
racksRouter.get(
    "/",
    authRequired,
    asyncHandler(async (req, res) => {
        const { datacenterId, q } = req.query as { datacenterId?: string; q?: string };
        const where: any = {};
        if (datacenterId) where.datacenterId = datacenterId;
        if (q) where.nom = { contains: q, mode: "insensitive" };

        const racks = await prisma.rack.findMany({
            where,
            orderBy: [{ datacenterId: "asc" }, { nom: "asc" }],
            select: {
                id: true,
                nom: true,
                localisation: true,
                nbUnites: true,
                datacenterId: true,
                posRow: true,
                posCol: true,
                rotationDeg: true,
                model: { select: { manufacturer: true, modelRef: true } },
                _count: { select: { components: true } },
            },
        });
        res.json(racks);
    })
);

// POST /api/racks
racksRouter.post(
    "/",
    authRequired,
    asyncHandler(async (req, res) => {
        const {
            nom,
            localisation,
            nbUnites,
            description,
            status,
            datacenterId,
            rackModelId,
            posRow,
            posCol,
            rotationDeg,
        } = req.body;

        if (!datacenterId) return res.status(400).json({ error: "datacenterId requis" });
        if (!nom) return res.status(400).json({ error: "nom requis" });

        const created = await prisma.rack.create({
            data: {
                nom,
                localisation: localisation ?? "",
                nbUnites: Number(nbUnites ?? 42),
                description: description ?? null,
                status: status ?? "prototype",
                datacenterId,
                rackModelId: rackModelId ?? null,
                posRow: posRow ?? null,
                posCol: posCol ?? null,
                rotationDeg: rotationDeg ?? 0,
            },
        });
        res.status(201).json(created);
    })
);

// GET /api/racks/:id (U 42→1 + composants + ports + liaisons)
racksRouter.get(
    "/:id",
    authRequired,
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        const rack = await prisma.rack.findUnique({
            where: { id },
            include: {
                datacenter: { select: { id: true, name: true } },
                model: true,
                unites: {
                    orderBy: { numero: "desc" },
                    include: {
                        composant: {
                            include: {
                                ports: {
                                    include: {
                                        liaisonAsA: { include: { portB: true } },
                                        liaisonAsB: { include: { portA: true } },
                                    },
                                },
                                model: { select: { vendor: true, model: true, function: true } },
                            },
                        },
                    },
                },
                components: {
                    where: { uniteId: null }, // ex: PDU/ODF accrochés
                    include: { ports: true, model: true },
                },
            },
        });
        if (!rack) return res.status(404).json({ error: "Rack non trouvé" });
        res.json(rack);
    })
);

// PUT /api/racks/:id
racksRouter.put(
    "/:id",
    authRequired,
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        const { nom, localisation, nbUnites, description, status, posRow, posCol, rotationDeg } = req.body;
        const updated = await prisma.rack.update({
            where: { id },
            data: {
                nom,
                localisation,
                nbUnites: nbUnites ? Number(nbUnites) : undefined,
                description,
                status: status ?? undefined,
                posRow: posRow ?? undefined,
                posCol: posCol ?? undefined,
                rotationDeg: rotationDeg ?? undefined,
            },
        });
        res.json(updated);
    })
);

// DELETE /api/racks/:id
racksRouter.delete(
    "/:id",
    authRequired,
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        await prisma.rack.delete({ where: { id } });
        res.status(204).send();
    })
);

// GET /api/racks/:id/unites-free
racksRouter.get(
    "/:id/unites-free",
    authRequired,
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        const unites = await prisma.unite.findMany({
            where: { rackId: id, composant: null },
            orderBy: { numero: "desc" },
        });
        res.json(unites);
    })
);

// -----------------------------------------------------------------------------
// Components Router (listing filtrable)
// -----------------------------------------------------------------------------
const componentsRouter = Router();

// GET /api/components?rackId=&datacenterId=&layer=&type=&q=
componentsRouter.get(
    "/",
    authRequired,
    asyncHandler(async (req, res) => {
        const { rackId, datacenterId, layer, type, q } = req.query as any;
        const where: any = {};
        if (rackId) where.rackId = Number(rackId);
        if (datacenterId) where.datacenterId = String(datacenterId); // pour les “libres”
        if (layer) where.layer = layer;
        if (type) where.type = type;
        if (q)
            where.OR = [
                { nom: { contains: q, mode: "insensitive" } },
                { modele: { contains: q, mode: "insensitive" } },
            ];

        const items = await prisma.component.findMany({
            where,
            orderBy: [{ rackId: "asc" }, { uniteId: "desc" }],
            include: {
                rack: { select: { id: true, nom: true, datacenterId: true } },
                unite: { select: { id: true, numero: true } },
                model: { select: { vendor: true, model: true, function: true } },
                ports: true,
            },
        });
        res.json(items);
    })
);

// -----------------------------------------------------------------------------
// Ports Router
// -----------------------------------------------------------------------------
const portsRouter = Router();

// GET /api/ports?componentId=
portsRouter.get(
    "/",
    authRequired,
    asyncHandler(async (req, res) => {
        const { componentId } = req.query as any;
        const where: any = {};
        if (componentId) where.componentId = Number(componentId);

        const items = await prisma.port.findMany({
            where,
            orderBy: [{ componentId: "asc" }, { index: "asc" }],
            include: {
                composant: { select: { id: true, nom: true } },
                liaisonAsA: { include: { portB: true } },
                liaisonAsB: { include: { portA: true } },
            },
        });
        res.json(items);
    })
);

// -----------------------------------------------------------------------------
// Liaisons Router
// -----------------------------------------------------------------------------
const liaisonsRouter = Router();

// GET /api/liaisons?datacenterId=&rackId=
liaisonsRouter.get(
    "/",
    authRequired,
    asyncHandler(async (req, res) => {
        const { datacenterId, rackId } = req.query as any;
        const where: any = {};

        if (rackId) {
            where.OR = [
                { portA: { composant: { rackId: Number(rackId) } } },
                { portB: { composant: { rackId: Number(rackId) } } },
            ];
        }
        if (datacenterId) {
            where.OR = [
                { portA: { composant: { rack: { datacenterId: datacenterId } } } },
                { portB: { composant: { rack: { datacenterId: datacenterId } } } },
            ];
        }

        const items = await prisma.liaison.findMany({
            where,
            include: {
                portA: { include: { composant: { select: { id: true, nom: true, rackId: true } } } },
                portB: { include: { composant: { select: { id: true, nom: true, rackId: true } } } },
                cableType: true,
            },
            orderBy: { id: "asc" },
        });
        res.json(items);
    })
);

// -----------------------------------------------------------------------------
// Catalogues Router (pour formulaires UI)
// -----------------------------------------------------------------------------
const catalogsRouter = Router();

// GET /api/catalogs/rack-models
catalogsRouter.get(
    "/rack-models",
    authRequired,
    asyncHandler(async (_req, res) => {
        const items = await prisma.rackModel.findMany({
            orderBy: [{ manufacturer: "asc" }, { modelRef: "asc" }],
        });
        res.json(items);
    })
);

// GET /api/catalogs/physical-models
catalogsRouter.get(
    "/physical-models",
    authRequired,
    asyncHandler(async (_req, res) => {
        const items = await prisma.physicalComponentModel.findMany({
            orderBy: [{ vendor: "asc" }, { model: "asc" }],
            include: { portTemplates: true },
        });
        res.json(items);
    })
);

// GET /api/catalogs/port-templates?modelId=
catalogsRouter.get(
    "/port-templates",
    authRequired,
    asyncHandler(async (req, res) => {
        const { modelId } = req.query as any;
        if (!modelId) return res.json([]);
        const items = await prisma.portTemplate.findMany({
            where: { modelId: String(modelId) },
            orderBy: [{ fixedName: "asc" }, { namePrefix: "asc" }, { startIndex: "asc" }],
        });
        res.json(items);
    })
);

// GET /api/catalogs/cable-types
catalogsRouter.get(
    "/cable-types",
    authRequired,
    asyncHandler(async (_req, res) => {
        const items = await prisma.cableTypeRef.findMany({
            orderBy: [{ vendor: "asc" }, { code: "asc" }],
        });
        res.json(items);
    })
);

// -----------------------------------------------------------------------------
// Projects Router (liste légère pour tabs)
// -----------------------------------------------------------------------------
const projectsRouter = Router();

// GET /api/projects?datacenterId=&q=
projectsRouter.get(
    "/",
    authRequired,
    asyncHandler(async (req, res) => {
        const { datacenterId, q } = req.query as any;
        const where: any = {};
        if (datacenterId) where.datacenterId = String(datacenterId);
        if (q)
            where.OR = [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
            ];

        const items = await prisma.project.findMany({
            where,
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                code: true,
                status: true,
                datacenterId: true,
                racks: { select: { rackId: true } },
            },
        });
        res.json(items);
    })
);

// GET /api/projects
app.get("/api/projects", authRequired, async (req, res) => {
    const { search, client, address } = req.query as Record<string, string | undefined>;

    const where: any = {
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        ...(client && client !== "Tous" ? { clientOrgId: client } : {}),
        ...(address ? { datacenter: { address: { contains: address, mode: "insensitive" } } } : {}),
    };

    const projects = await prisma.project.findMany({
        where,
        include: {
            datacenter: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    _count: { select: { racks: true } },
                },
            },
            client: {
                select: { name: true }
            },
        },
        orderBy: { createdAt: "desc" },
    });

    res.json(projects);
});

app.post("/api/projects", authRequired, async (req, res) => {
    try {
        const b = req.body as {
            name: string;
            code?: string | null;
            description?: string | null;
            status?: string;
            datacenterId?: string | null;
            clientOrgId?: string | null;
            startDate?: string | null;
            endDate?: string | null;
        };

        if (!b?.name?.trim()) {
            return res.status(400).json({ message: "Le nom est obligatoire." });
        }

        if (!b?.clientOrgId || !b.clientOrgId.trim()) {
            return res.status(400).json({ message: "Sélectionne une organisation cliente." });
        }

        const statusMap: Record<string, ProjectStatus> = {
            PLANNED: ProjectStatus.PLANNED,
            ACTIVE: ProjectStatus.IN_PROGRESS,
            IN_PROGRESS: ProjectStatus.IN_PROGRESS,
            PAUSED: ProjectStatus.ON_HOLD,
            ON_HOLD: ProjectStatus.ON_HOLD,
            DONE: ProjectStatus.DONE,
            CANCELLED: ProjectStatus.CANCELLED,
        };
        const statusUpper = (b.status ?? "Planned").toUpperCase();
        const statusEnum: ProjectStatus =
            statusMap[statusUpper] ?? ProjectStatus.PLANNED;

        const data: Prisma.ProjectUncheckedCreateInput = {
            name: b.name.trim(),
            code: b.code?.trim() || null,
            description: b.description?.trim() || null,
            status: statusEnum,
            datacenterId: b.datacenterId || null,
            clientOrgId: b.clientOrgId!,
            startDate: b.startDate ? new Date(b.startDate) : null,
            endDate: b.endDate ? new Date(b.endDate) : null,
        };

        const created = await prisma.project.create({ data });
        return res.status(201).json(created);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Erreur serveur." });
    }
});

// Lister les projets
app.get("/api/projects", authRequired, async (_req, res) => {
    const list = await prisma.project.findMany({
        include: {
            datacenter: true,
            client: true,
        },
        orderBy: { createdAt: "desc" },
    });
    res.json(list);
});

// Supprimer un projet
app.delete("/api/projects/:id", authRequired, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.project.delete({ where: { id } });
        res.status(204).send();
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
            return res.status(409).json({ message: "Impossible de supprimer : des éléments y sont rattachés." });
        }
        console.error(e);
        res.status(500).json({ message: "Erreur serveur." });
    }
});

app.put("/api/projects/:id", authRequired, async (req, res) => {
    try {
        const { id } = req.params;
        const b = req.body as {
            name?: string;
            code?: string | null;
            description?: string | null;
            status?: string;
            datacenterId?: string | null;
            clientOrgId?: string | null;
            startDate?: string | null;
            endDate?: string | null;
        };

        const statusMap: Record<string, ProjectStatus> = {
            PLANNED: ProjectStatus.PLANNED,
            ACTIVE: ProjectStatus.IN_PROGRESS,
            IN_PROGRESS: ProjectStatus.IN_PROGRESS,
            PAUSED: ProjectStatus.ON_HOLD,
            ON_HOLD: ProjectStatus.ON_HOLD,
            DONE: ProjectStatus.DONE,
            CANCELLED: ProjectStatus.CANCELLED,
        };
        const statusEnum =
            b.status ? (statusMap[b.status.toUpperCase()] ?? ProjectStatus.PLANNED) : undefined;

        const data: Prisma.ProjectUncheckedUpdateInput = {
            name: b.name?.trim(),
            code: (b.code ?? null) as string | null,
            description: (b.description ?? null) as string | null,
            status: statusEnum,
            datacenterId: b.datacenterId ?? undefined,
            clientOrgId:
                typeof b.clientOrgId === "string" && b.clientOrgId.trim()
                    ? b.clientOrgId
                    : undefined,
            startDate: b.startDate ? new Date(b.startDate) : null,
            endDate: b.endDate ? new Date(b.endDate) : null,
        };

        const updated = await prisma.project.update({ where: { id }, data });
        res.json(updated);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Erreur serveur." });
    }
});

// -----------------------------------------------------------------------------
// Org
// -----------------------------------------------------------------------------
app.get("/api/organizations", authRequired, async (_req, res) => {
    const orgs = await prisma.organization.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
    });
    res.json(orgs);
});
// -----------------------------------------------------------------------------
// SiteAssets Router
// -----------------------------------------------------------------------------
const siteAssetsRouter = Router();
app.use("/api/site-assets", siteAssetsRouter);

// GET /api/site-assets/:id
siteAssetsRouter.get("/:id", authRequired, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const asset = await prisma.siteAsset.findUnique({ where: { id } });
    if (!asset) return res.status(404).json({ error: "Asset non trouvé" });
    res.json(asset);
}));

// PUT /api/site-assets/:id  (éditer rotation/longueur/label/notes/position)
siteAssetsRouter.put("/:id", authRequired, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { kind, label, posRow, posCol, spanRows, spanCols, rotationDeg, notes } = req.body ?? {};
    const updated = await prisma.siteAsset.update({
        where: { id },
        data: {
            ...(kind       ? { kind } : {}),
            ...(label      !== undefined ? { label } : {}),
            ...(posRow     !== undefined ? { posRow: Number(posRow) } : {}),
            ...(posCol     !== undefined ? { posCol: Number(posCol) } : {}),
            ...(spanRows   !== undefined ? { spanRows: Number(spanRows) } : {}),
            ...(spanCols   !== undefined ? { spanCols: Number(spanCols) } : {}),
            ...(rotationDeg!== undefined ? { rotationDeg: Number(rotationDeg) } : {}),
            ...(notes      !== undefined ? { notes } : {}),
        },
    });
    res.json(updated);
}));

// DELETE /api/site-assets/:id
siteAssetsRouter.delete("/:id", authRequired, asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.siteAsset.delete({ where: { id } });
    res.status(204).send();
}));

// POST /api/datacenters/:dcId/site-assets  (créer un asset rattaché à un DC)
datacentersRouter.post("/:dcId/site-assets", authRequired, asyncHandler(async (req, res) => {
    const { dcId } = req.params;
    const { kind, label, posRow, posCol, spanRows, spanCols, rotationDeg, notes } = req.body ?? {};
    const created = await prisma.siteAsset.create({
        data: {
            datacenterId: dcId,
            kind,
            label: label ?? null,
            posRow: Number(posRow ?? 0),
            posCol: Number(posCol ?? 0),
            spanRows: Number(spanRows ?? 1),
            spanCols: Number(spanCols ?? 1),
            rotationDeg: Number(rotationDeg ?? 0),
            notes: notes ?? null,
        },
    });
    res.status(201).json(created);
}));


// ===================== DATACENTERS MINIMAL LIST =====================

app.get("/api/datacenters", authRequired, async (req, res) => {
    // option: ?fields=id,name pour limiter le payload
    const fields = String(req.query.fields || "");
    const select = fields.includes("id") && fields.includes("name")
        ? { id: true, name: true }
        : undefined;

    const rows = await prisma.datacenter.findMany({
        select,
        orderBy: { name: "asc" },
    });
    res.json(rows);
});

// -----------------------------------------------------------------------------
// Mount (NOUVELLE API)
// -----------------------------------------------------------------------------
app.use("/api/datacenters", datacentersRouter);
app.use("/api/racks", racksRouter);
app.use("/api/components", componentsRouter);
app.use("/api/ports", portsRouter);
app.use("/api/liaisons", liaisonsRouter);
app.use("/api/catalogs", catalogsRouter);
app.use("/api/projects", projectsRouter);

// -----------------------------------------------------------------------------
// Legacy aliases (compatibilité avec ton front existant)
// -----------------------------------------------------------------------------
const addLegacyHeaders: RequestHandler = (_req, res, next) => {
    res.setHeader("Deprecation", "true");
    res.setHeader("Link", '</api>; rel="successor-version"');
    next();
};

app.use("/datacenters", addLegacyHeaders, datacentersRouter);
app.use("/racks", addLegacyHeaders, racksRouter);
app.use("/components", addLegacyHeaders, componentsRouter);
app.use("/ports", addLegacyHeaders, portsRouter);
app.use("/liaisons", addLegacyHeaders, liaisonsRouter);
app.use("/catalogs", addLegacyHeaders, catalogsRouter);
app.use("/projects", addLegacyHeaders, projectsRouter);

// -----------------------------------------------------------------------------
// Error handler
// -----------------------------------------------------------------------------
app.use((
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(err);
    res.status(500).json({ error: "Erreur serveur", details: msg });
});

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

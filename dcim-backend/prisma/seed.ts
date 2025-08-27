// prisma/seed.ts
import {
    PrismaClient,
    RackDoorStyle,
    RackColor,
    PhysicalFunction,
    ComponentLayer,
    ComponentStatus,
    ComponentType,
    PortConnector,
    PortFace,
    PortKind,
    CableType,
    LinkStatus,
    RedundancyPlan,
    OrgType,
    ProjectStatus,
    ProjectContactRole,
    DatacenterContactRole,
    RequestStatus,
    RackStatus,
    RackSide,
    SiteAssetKind,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    /* ===========================
       0) Utilitaires
    ============================ */
    const now = new Date();
    const addDays = (d: number) => new Date(Date.now() + d * 86400000);

    /* ===========================
       1) Users (5)
    ============================ */
    const users = [
        "warda.bahar3117@gmail.com",
        "admin@datacenter.tn",
        "ops@datacenter.tn",
        "net@datacenter.tn",
        "guest@datacenter.tn",
    ];
    for (const email of users) {
        await prisma.user.upsert({
            where: { email },
            update: { isAuthorized: true },
            create: { email, isAuthorized: true },
        });
    }

    /* ===========================
       2) OTP Codes (5)
    ============================ */
    await prisma.otpCode.deleteMany({});
    await prisma.otpCode.createMany({
        data: [
            { email: users[0], code: "111111", expiresAt: addDays(1) },
            { email: users[1], code: "222222", expiresAt: addDays(1) },
            { email: users[2], code: "333333", expiresAt: addDays(1) },
            { email: users[3], code: "444444", expiresAt: addDays(1) },
            { email: users[4], code: "555555", expiresAt: addDays(1) },
        ],
    });

    /* ===========================
       3) AccessRequest (5)
    ============================ */
    await prisma.accessRequest.deleteMany({});
    await prisma.accessRequest.createMany({
        data: [
            { email: "new1@org.tn", message: "Access please", status: RequestStatus.PENDING },
            { email: "new2@org.tn", message: "Grant me DC view", status: RequestStatus.APPROVED, handledAt: now, handledBy: users[1] },
            { email: "new3@org.tn", message: "Need to check racks", status: RequestStatus.REJECTED, handledAt: now, handledBy: users[1] },
            { email: "new4@org.tn", message: "API access", status: RequestStatus.PENDING },
            { email: "new5@org.tn", message: "Ports & links module", status: RequestStatus.PENDING },
        ],
    });

    /* ===========================
       4) Organizations (5)
    ============================ */
    const orgs = await Promise.all([
        prisma.organization.upsert({
            where: { name: "Ericsson" },
            update: {},
            create: { name: "Ericsson", type: OrgType.ERICSSON, country: "SE" },
        }),
        prisma.organization.upsert({
            where: { name: "Tunisie Telecom" },
            update: {},
            create: { name: "Tunisie Telecom", type: OrgType.CLIENT, country: "TN" },
        }),
        prisma.organization.upsert({
            where: { name: "Dell" },
            update: {},
            create: { name: "Dell", type: OrgType.VENDOR, country: "US" },
        }),
        prisma.organization.upsert({
            where: { name: "HPE" },
            update: {},
            create: { name: "HPE", type: OrgType.VENDOR, country: "US" },
        }),
        prisma.organization.upsert({
            where: { name: "Lenovo" },
            update: {},
            create: { name: "Lenovo", type: OrgType.VENDOR, country: "CN" },
        }),
    ]);

    /* ===========================
       5) Contacts (5)
    ============================ */
    const contacts = await Promise.all([
        prisma.contact.create({
            data: {
                fullName: "Mounir Ben Youssef",
                title: "PM",
                orgId: orgs[0].id, // Ericsson
                emails: ["mounir@ericsson.tn"],
                phones: ["+216 98 511 565"],
                preferredChannel: "email",
            },
        }),
        prisma.contact.create({
            data: {
                fullName: "Karim Ben Said",
                title: "Engineer",
                orgId: orgs[0].id,
                emails: ["karim@ericsson.tn"],
                phones: ["+216 98 367 843"],
            },
        }),
        prisma.contact.create({
            data: {
                fullName: "Asma Chabir",
                title: "DC Manager",
                orgId: orgs[1].id, // TT
                emails: ["asma@tt.tn"],
                phones: ["+216 98 905 331"],
            },
        }),
        prisma.contact.create({
            data: {
                fullName: "Dell Presales",
                title: "Presales",
                orgId: orgs[2].id,
                emails: ["sales@dell.com"],
                phones: ["+1 111 111 1111"],
            },
        }),
        prisma.contact.create({
            data: {
                fullName: "HPE Support",
                title: "Support",
                orgId: orgs[3].id,
                emails: ["support@hpe.com"],
                phones: ["+1 222 222 2222"],
            },
        }),
    ]);

    /* ===========================
       6) Datacenters (5)
    ============================ */
    const dcs = await Promise.all([
        prisma.datacenter.upsert({
            where: { name: "MSC SOUSSE (NFVI)" },
            update: {},
            create: {
                name: "MSC SOUSSE (NFVI)",
                client: "Ericsson",
                siteName: "Sousse NFVI",
                acVoltage: "230/380",
                phases: "3P",
                frequency: 50,
                coolingType: "Down flow",
                coolingUnits: 6,
                powerPlant: true,
                groundingType: "Single-point",
                gridRows: 20,
                gridCols: 30,
                gridCellSizeMm: 600,
            },
        }),
        prisma.datacenter.upsert({
            where: { name: "Ouardia" },
            update: {},
            create: { name: "Ouardia", client: "Ericsson", gridRows: 12, gridCols: 18, gridCellSizeMm: 600 },
        }),
        prisma.datacenter.upsert({
            where: { name: "Tunis HQ" },
            update: {},
            create: { name: "Tunis HQ", client: "Tunisie Telecom", siteName: "HQ", gridRows: 15, gridCols: 20, gridCellSizeMm: 600 },
        }),
        prisma.datacenter.upsert({
            where: { name: "Sfax Edge" },
            update: {},
            create: { name: "Sfax Edge", client: "Tunisie Telecom", gridRows: 10, gridCols: 16, gridCellSizeMm: 600 },
        }),
        prisma.datacenter.upsert({
            where: { name: "Monastir Backup" },
            update: {},
            create: { name: "Monastir Backup", client: "Ericsson", gridRows: 10, gridCols: 15, gridCellSizeMm: 600 },
        }),
    ]);

    /* ===========================
       7) SiteAssets (5)
    ============================ */
    await prisma.siteAsset.createMany({
        data: [
            { datacenterId: dcs[0].id, kind: SiteAssetKind.DOOR, label: "Main Door", posRow: 1, posCol: 1, spanRows: 1, spanCols: 2, rotationDeg: 0 },
            { datacenterId: dcs[0].id, kind: SiteAssetKind.ODF, label: "ODF-A", posRow: 2, posCol: 1, spanRows: 2, spanCols: 1 },
            { datacenterId: dcs[0].id, kind: SiteAssetKind.COOLING, label: "CRAC-1", posRow: 3, posCol: 28, spanRows: 2, spanCols: 2 },
            { datacenterId: dcs[1].id, kind: SiteAssetKind.DDF, label: "DDF-1", posRow: 5, posCol: 2 },
            { datacenterId: dcs[2].id, kind: SiteAssetKind.NOTE, label: "Reserved zone", posRow: 1, posCol: 10, notes: "Do not place racks here" },
        ],
    });

    /* ===========================
       8) RackModels (5)
       unique: (manufacturer, modelRef)
    ============================ */
    const rmHpe = await prisma.rackModel.upsert({
        where: { manufacturer_modelRef: { manufacturer: "HPE", modelRef: "G2 Enterprise 42U 800x1075" } },
        update: {},
        create: {
            manufacturer: "HPE",
            modelRef: "G2 Enterprise 42U 800x1075",
            uHeight: 42,
            widthMm: 800,
            depthMm: 1075,
            frontDoorStyle: RackDoorStyle.PERFORATED,
            rearDoorStyle: RackDoorStyle.PERFORATED,
            color: RackColor.BLACK,
            warrantyYears: 10,
            shockPalletSupported: true,
            shipPreconfiguredOk: true,
        },
    });
    const rmDell = await prisma.rackModel.upsert({
        where: { manufacturer_modelRef: { manufacturer: "Dell", modelRef: "Enterprise Rack 42U" } },
        update: {},
        create: {
            manufacturer: "Dell",
            modelRef: "Enterprise Rack 42U",
            uHeight: 42,
            widthMm: 800,
            depthMm: 1070,
            frontDoorStyle: RackDoorStyle.SOLID,
            rearDoorStyle: RackDoorStyle.PERFORATED,
            color: RackColor.GREY,
        },
    });
    const rmLenovo = await prisma.rackModel.upsert({
        where: { manufacturer_modelRef: { manufacturer: "Lenovo", modelRef: "ThinkSystem Rack 42U" } },
        update: {},
        create: {
            manufacturer: "Lenovo",
            modelRef: "ThinkSystem Rack 42U",
            uHeight: 42,
            widthMm: 800,
            depthMm: 1100,
            frontDoorStyle: RackDoorStyle.PERFORATED,
            rearDoorStyle: RackDoorStyle.PERFORATED,
            color: RackColor.BLACK,
        },
    });
    const rmErc = await prisma.rackModel.upsert({
        where: { manufacturer_modelRef: { manufacturer: "Ericsson", modelRef: "HP Cabinet 42U" } },
        update: {},
        create: {
            manufacturer: "Ericsson",
            modelRef: "HP Cabinet 42U",
            uHeight: 42,
            widthMm: 600,
            depthMm: 1000,
            frontDoorStyle: RackDoorStyle.MESH,
            rearDoorStyle: RackDoorStyle.MESH,
            color: RackColor.WHITE,
        },
    });
    const rmStd = await prisma.rackModel.upsert({
        where: { manufacturer_modelRef: { manufacturer: "Generic", modelRef: "Standard Rack 42U" } },
        update: {},
        create: {
            manufacturer: "Generic",
            modelRef: "Standard Rack 42U",
            uHeight: 42,
            widthMm: 800,
            depthMm: 1000,
            frontDoorStyle: RackDoorStyle.PERFORATED,
            rearDoorStyle: RackDoorStyle.SOLID,
            color: RackColor.BLACK,
        },
    });

    /* ===========================
       9) Racks (5)
       unique: (datacenterId, nom)
    ============================ */
    const r1 = await prisma.rack.upsert({
        where: { datacenterId_nom: { datacenterId: dcs[0].id, nom: "Rack-1" } },
        update: {},
        create: {
            nom: "Rack-1",
            localisation: "Sousse Room A",
            nbUnites: 42,
            status: RackStatus.prototype,
            datacenterId: dcs[0].id,
            rackModelId: rmHpe.id,
            posRow: 7,
            posCol: 20,
        },
    });
    const r2 = await prisma.rack.upsert({
        where: { datacenterId_nom: { datacenterId: dcs[0].id, nom: "Rack-2" } },
        update: {},
        create: {
            nom: "Rack-2",
            localisation: "Sousse Room B",
            nbUnites: 42,
            datacenterId: dcs[0].id,
            rackModelId: rmDell.id,
            posRow: 7,
            posCol: 22,
        },
    });
    const r3 = await prisma.rack.upsert({
        where: { datacenterId_nom: { datacenterId: dcs[1].id, nom: "Rack-3" } },
        update: {},
        create: {
            nom: "Rack-3",
            localisation: "Ouardia Room 1",
            nbUnites: 42,
            datacenterId: dcs[1].id,
            rackModelId: rmLenovo.id,
        },
    });
    const r4 = await prisma.rack.upsert({
        where: { datacenterId_nom: { datacenterId: dcs[2].id, nom: "Rack-4" } },
        update: {},
        create: {
            nom: "Rack-4",
            localisation: "Tunis HQ Room C",
            nbUnites: 42,
            datacenterId: dcs[2].id,
            rackModelId: rmErc.id,
        },
    });
    const r5 = await prisma.rack.upsert({
        where: { datacenterId_nom: { datacenterId: dcs[3].id, nom: "Rack-5" } },
        update: {},
        create: {
            nom: "Rack-5",
            localisation: "Sfax Edge Room D",
            nbUnites: 42,
            datacenterId: dcs[3].id,
            rackModelId: rmStd.id,
        },
    });

    /* ===========================
       10) Unités (5)
    ============================ */
    const unites = await Promise.all([
        prisma.unite.create({ data: { numero: 42, rackId: r1.id } }),
        prisma.unite.create({ data: { numero: 41, rackId: r1.id } }),
        prisma.unite.create({ data: { numero: 40, rackId: r2.id } }),
        prisma.unite.create({ data: { numero: 39, rackId: r3.id } }),
        prisma.unite.create({ data: { numero: 38, rackId: r4.id } }),
    ]);

    /* ===========================
       11) PhysicalComponentModel (5)
       unique: (model, vendor, function)
    ============================ */
    const pmR640 = await prisma.physicalComponentModel.upsert({
        where: { model_vendor_function: { model: "PowerEdge R640", vendor: "Dell", function: PhysicalFunction.RTE_SERVER } },
        update: {},
        create: { vendor: "Dell", model: "PowerEdge R640", function: PhysicalFunction.RTE_SERVER, ports: 4 },
    });
    const pmNRU = await prisma.physicalComponentModel.upsert({
        where: { model_vendor_function: { model: "NRU 0301", vendor: "Ericsson", function: PhysicalFunction.NETWORK_SWITCH } },
        update: {},
        create: { vendor: "Ericsson", model: "NRU 0301", function: PhysicalFunction.NETWORK_SWITCH, ports: 48 },
    });
    const pmDL380 = await prisma.physicalComponentModel.upsert({
        where: { model_vendor_function: { model: "ProLiant DL380 Gen10", vendor: "HPE", function: PhysicalFunction.RTE_SERVER } },
        update: {},
        create: { vendor: "HPE", model: "ProLiant DL380 Gen10", function: PhysicalFunction.RTE_SERVER, ports: 4 },
    });
    const pmSR650V2 = await prisma.physicalComponentModel.upsert({
        where: { model_vendor_function: { model: "ThinkSystem SR650 V2", vendor: "Lenovo", function: PhysicalFunction.RTE_SERVER } },
        update: {},
        create: { vendor: "Lenovo", model: "ThinkSystem SR650 V2", function: PhysicalFunction.RTE_SERVER, ports: 6 },
    });
    const pmEX4300 = await prisma.physicalComponentModel.upsert({
        where: { model_vendor_function: { model: "EX4300", vendor: "Juniper", function: PhysicalFunction.NETWORK_SWITCH } },
        update: {},
        create: { vendor: "Juniper", model: "EX4300", function: PhysicalFunction.NETWORK_SWITCH, ports: 24 },
    });

    /* ===========================
       12) PortTemplates (5)
    ============================ */
    await prisma.portTemplate.createMany({
        data: [
            { modelId: pmNRU.id, namePrefix: "Eth", startIndex: 0, endIndex: 47, face: PortFace.FRONT, kind: PortKind.NETWORK, connector: PortConnector.SFP_PLUS, speedMbps: 10000 },
            { modelId: pmEX4300.id, namePrefix: "ge-", startIndex: 0, endIndex: 23, face: PortFace.FRONT, kind: PortKind.NETWORK, connector: PortConnector.SFP, speedMbps: 1000 },
            { modelId: pmR640.id, fixedName: "iDRAC", face: PortFace.REAR, kind: PortKind.NETWORK, connector: PortConnector.RJ45, speedMbps: 1000 },
            { modelId: pmDL380.id, namePrefix: "NIC", startIndex: 1, endIndex: 4, face: PortFace.REAR, kind: PortKind.NETWORK, connector: PortConnector.SFP_PLUS, speedMbps: 10000 },
            { modelId: pmSR650V2.id, namePrefix: "NIC", startIndex: 1, endIndex: 4, face: PortFace.REAR, kind: PortKind.NETWORK, connector: PortConnector.SFP_PLUS, speedMbps: 10000 },
        ],
    });

    /* ===========================
       13) Components (5)
    ============================ */
    const c1 = await prisma.component.create({
        data: {
            nom: "AppServer-1",
            layer: ComponentLayer.PHYSICAL,
            rackId: r1.id,
            uniteId: unites[0].id,
            type: ComponentType.serveur_rackable,
            modele: "Dell PowerEdge R640",
            statut: ComponentStatus.actif,
            color: "#2E7D32",
            modelId: pmR640.id,
            rackSide: RackSide.FRONT,
        },
    });
    const c2 = await prisma.component.create({
        data: {
            nom: "CoreSwitch-1",
            layer: ComponentLayer.PHYSICAL,
            rackId: r1.id,
            uniteId: null,
            type: ComponentType.switch,
            modele: "Ericsson NRU 0301",
            statut: ComponentStatus.actif,
            color: "#1565C0",
            modelId: pmNRU.id,
            rackSide: RackSide.FRONT,
        },
    });
    const c3 = await prisma.component.create({
        data: {
            nom: "DB-Server-1",
            layer: ComponentLayer.PHYSICAL,
            rackId: r2.id,
            uniteId: unites[2].id,
            type: ComponentType.serveur_rackable,
            modele: "HPE ProLiant DL380 Gen10",
            statut: ComponentStatus.actif,
            modelId: pmDL380.id,
            rackSide: RackSide.FRONT,
        },
    });
    const c4 = await prisma.component.create({
        data: {
            nom: "Compute-1",
            layer: ComponentLayer.PHYSICAL,
            rackId: r3.id,
            uniteId: unites[3].id,
            type: ComponentType.serveur_rackable,
            modele: "Lenovo ThinkSystem SR650 V2",
            statut: ComponentStatus.inactif,
            modelId: pmSR650V2.id,
            rackSide: RackSide.FRONT,
        },
    });
    const c5 = await prisma.component.create({
        data: {
            nom: "AccessSwitch-1",
            layer: ComponentLayer.PHYSICAL,
            rackId: r4.id,
            type: ComponentType.switch,
            modele: "Juniper EX4300",
            statut: ComponentStatus.actif,
            modelId: pmEX4300.id,
            rackSide: RackSide.FRONT,
        },
    });

    /* ===========================
       14) Ports (10 min) — on en crée 10 (>=5)
    ============================ */
    const ports: number[] = [];
    // Switch NRU: 4 ports
    for (let i = 0; i < 4; i++) {
        const p = await prisma.port.create({
            data: {
                componentId: c2.id,
                name: `Eth${i}`,
                index: i,
                face: PortFace.FRONT,
                kind: PortKind.NETWORK,
                connector: PortConnector.SFP_PLUS,
                speedMbps: 10000,
            },
        });
        ports.push(p.id);
    }

    // EX4300: 4 ports
    for (let i = 0; i < 4; i++) {
        const p = await prisma.port.create({
            data: {
                componentId: c5.id,
                name: `ge-0/0/${i}`,
                index: i,
                face: PortFace.FRONT,
                kind: PortKind.NETWORK,
                connector: PortConnector.SFP,
                speedMbps: 1000,
            },
        });
        ports.push(p.id);
    }
    // R640 iDRAC + NIC1
    // Port supplémentaire sur l'EX pour éviter le conflit d'unicité
    const pEX_extra = await prisma.port.create({
        data: {
            componentId: c5.id,
            name: "ge-0/0/8",
            index: 8,
            face: PortFace.FRONT,
            kind: PortKind.NETWORK,
            connector: PortConnector.SFP,
            speedMbps: 1000,
        },
    });

    const pIdrac = await prisma.port.create({
        data: {
            componentId: c1.id,
            name: "iDRAC",
            index: 0,
            face: PortFace.REAR,
            kind: PortKind.NETWORK,
            connector: PortConnector.RJ45,
            speedMbps: 1000,
        },
    });
    ports.push(pIdrac.id);
    const pNic1 = await prisma.port.create({
        data: {
            componentId: c1.id,
            name: "NIC1",
            index: 1,
            face: PortFace.REAR,
            kind: PortKind.NETWORK,
            connector: PortConnector.SFP_PLUS,
            speedMbps: 10000,
        },
    });
    ports.push(pNic1.id);

    /* ===========================
       15) CableTypeRef (5)
    ============================ */
    const cables = await Promise.all([
        prisma.cableTypeRef.create({
            data: { code: "CAT6A-STD", label: "CAT6A Patch", vendor: "Generic", category: CableType.CAT6A, defaultSpeed: "1G/10G", defaultLengthM: 3 },
        }),
        prisma.cableTypeRef.create({
            data: { code: "DAC-100G", label: "DAC 100G", vendor: "Generic", category: CableType.DAC_100G, defaultSpeed: "100G", defaultLengthM: 2 },
        }),
        prisma.cableTypeRef.create({
            data: { code: "DAC-40G", label: "DAC 40G", vendor: "Generic", category: CableType.DAC_40G, defaultSpeed: "40G", defaultLengthM: 2 },
        }),
        prisma.cableTypeRef.create({
            data: { code: "FIBER-SM-LC", label: "SM LC Fiber", vendor: "Generic", category: CableType.FIBER_SM_LC, defaultSpeed: "10G/100G", defaultLengthM: 10 },
        }),
        prisma.cableTypeRef.create({
            data: { code: "PWR-C13C14", label: "Power C13-C14", vendor: "Generic", category: CableType.POWER_C13_C14, defaultSpeed: "AC", defaultLengthM: 2 },
        }),
    ]);

    /* ===========================
       16) Liaisons (5)
    ============================ */
    // On relie 2 par 2 (NRU <-> EX), (R640 iDRAC -> EX), etc.
    const lia1 = await prisma.liaison.create({
        data: {
            portAId: ports[0], // NRU Eth0
            portBId: ports[4], // EX ge-0/0/0
            cableTypeId: cables[0].id,
            type: CableType.CAT6A,
            vitesse: "1G",
            plan: RedundancyPlan.A,
            status: LinkStatus.ACTIVE,
        },
    });
    const lia2 = await prisma.liaison.create({
        data: {
            portAId: ports[1],
            portBId: ports[5],
            cableTypeId: cables[1].id,
            type: CableType.DAC_100G,
            vitesse: "10G",
            plan: RedundancyPlan.B,
            status: LinkStatus.ACTIVE,
        },
    });
    const lia3 = await prisma.liaison.create({
        data: {
            portAId: ports[2],
            portBId: ports[6],
            cableTypeId: cables[2].id,
            type: CableType.DAC_40G,
            vitesse: "10G",
            status: LinkStatus.PLANNED,
        },
    });
    const lia4 = await prisma.liaison.create({
        data: {
            portAId: ports[3],
            portBId: ports[7],
            type: CableType.FIBER_SM_LC,
            vitesse: "10G",
            status: LinkStatus.ACTIVE,
        },
    });
    const lia5 = await prisma.liaison.create({
        data: {
            portAId: pIdrac.id,
            portBId: pEX_extra.id,
            type: CableType.CAT6A,
            vitesse: "1G",
            status: LinkStatus.ACTIVE,
            description: "iDRAC -> EX access",
        },
    });


    /* ===========================
       17) Projects (5)
    ============================ */
    const projects = await Promise.all([
        prisma.project.create({
            data: {
                name: "MSC NFVI Sousse",
                code: "MSC-SSE",
                status: ProjectStatus.IN_PROGRESS,
                clientOrgId: orgs[1].id, // TT
                datacenterId: dcs[0].id,
                startDate: addDays(-30),
            },
        }),
        prisma.project.create({
            data: {
                name: "Ouardia Upgrade",
                code: "OUA-UP",
                status: ProjectStatus.PLANNED,
                clientOrgId: orgs[1].id,
                datacenterId: dcs[1].id,
            },
        }),
        prisma.project.create({
            data: {
                name: "HQ Optimization",
                code: "HQ-OPT",
                status: ProjectStatus.PLANNED,
                clientOrgId: orgs[1].id,
                datacenterId: dcs[2].id,
            },
        }),
        prisma.project.create({
            data: {
                name: "Sfax Edge Rollout",
                code: "SFX-EDGE",
                status: ProjectStatus.ON_HOLD,
                clientOrgId: orgs[1].id,
                datacenterId: dcs[3].id,
            },
        }),
        prisma.project.create({
            data: {
                name: "Monastir DR",
                code: "MNS-DR",
                status: ProjectStatus.PLANNED,
                clientOrgId: orgs[1].id,
                datacenterId: dcs[4].id,
            },
        }),
    ]);

    /* ===========================
       18) ProjectAlias (5)
    ============================ */
    await prisma.projectAlias.createMany({
        data: [
            { projectId: projects[0].id, key: "short", value: "MSC-SSE" },
            { projectId: projects[1].id, key: "short", value: "OUA-UP" },
            { projectId: projects[2].id, key: "short", value: "HQ-OPT" },
            { projectId: projects[3].id, key: "short", value: "SFX-EDGE" },
            { projectId: projects[4].id, key: "short", value: "MNS-DR" },
        ],
    });

    /* ===========================
       19) ProjectContact (5)
       PK composite: (projectId, contactId, role)
    ============================ */
    await prisma.projectContact.createMany({
        data: [
            { projectId: projects[0].id, contactId: contacts[0].id, role: ProjectContactRole.PM },
            { projectId: projects[0].id, contactId: contacts[2].id, role: ProjectContactRole.PRIMARY },
            { projectId: projects[1].id, contactId: contacts[1].id, role: ProjectContactRole.TECHNICAL },
            { projectId: projects[2].id, contactId: contacts[3].id, role: ProjectContactRole.OPS },
            { projectId: projects[3].id, contactId: contacts[4].id, role: ProjectContactRole.SECURITY },
        ],
    });

    /* ===========================
       20) DatacenterContact (5)
       PK composite: (datacenterId, contactId, role)
    ============================ */
    await prisma.datacenterContact.createMany({
        data: [
            { datacenterId: dcs[0].id, contactId: contacts[2].id, role: DatacenterContactRole.ON_SITE, availability: "9:00-17:00" },
            { datacenterId: dcs[0].id, contactId: contacts[0].id, role: DatacenterContactRole.IT },
            { datacenterId: dcs[1].id, contactId: contacts[1].id, role: DatacenterContactRole.IT },
            { datacenterId: dcs[2].id, contactId: contacts[3].id, role: DatacenterContactRole.POWER },
            { datacenterId: dcs[3].id, contactId: contacts[4].id, role: DatacenterContactRole.FACILITIES },
        ],
    });

    /* ===========================
       21) ProjectRack (5)
       PK composite: (projectId, rackId)
    ============================ */
    await prisma.projectRack.createMany({
        data: [
            { projectId: projects[0].id, rackId: r1.id, notes: "Main NFVI rack" },
            { projectId: projects[0].id, rackId: r2.id },
            { projectId: projects[1].id, rackId: r3.id },
            { projectId: projects[2].id, rackId: r4.id },
            { projectId: projects[3].id, rackId: r5.id },
        ],
    });

    /* ===========================
       22) ChangeLog (5)
    ============================ */
    await prisma.changeLog.createMany({
        data: [
            { entityType: "RACK", entityId: String(r1.id), action: "CREATE", userEmail: users[1], diffJson: { nbUnites: 42 } },
            { entityType: "COMPONENT", entityId: String(c1.id), action: "CREATE", userEmail: users[1], diffJson: { nom: "AppServer-1" } },
            { entityType: "PORT", entityId: String(ports[0]), action: "CREATE", userEmail: users[2] },
            { entityType: "LIAISON", entityId: String(lia1.id), action: "CREATE", userEmail: users[2] },
            { entityType: "PROJECT", entityId: String(projects[0].id), action: "CREATE", userEmail: users[1] },
        ],
    });

    console.log("✅ Seed COMPLET inséré (5 lignes par table).");
}

main()
    .catch(async (e) => {
        console.error("❌ Seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

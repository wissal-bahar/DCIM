/*
  Warnings:

  - You are about to drop the column `forme` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Port` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[datacenterId,nom]` on the table `Rack` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Component` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Liaison` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Port` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Rack` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."OrgType" AS ENUM ('CLIENT', 'ERICSSON', 'VENDOR', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ProjectContactRole" AS ENUM ('PRIMARY', 'TECHNICAL', 'PM', 'SECURITY', 'OPS', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."DatacenterContactRole" AS ENUM ('ON_SITE', 'SECURITY_GATE', 'FACILITIES', 'POWER', 'IT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RackLockType" AS ENUM ('MECHANICAL', 'ELECTRONIC_READY', 'BIOMETRIC_READY');

-- CreateEnum
CREATE TYPE "public"."RackDoorStyle" AS ENUM ('PERFORATED', 'SOLID', 'MESH');

-- CreateEnum
CREATE TYPE "public"."RackColor" AS ENUM ('BLACK', 'WHITE', 'GREY', 'BLUE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ComponentLayer" AS ENUM ('PHYSICAL', 'LOGICAL');

-- CreateEnum
CREATE TYPE "public"."PhysicalFunction" AS ENUM ('COMPUTER_SYSTEM', 'RTE_SERVER', 'STORAGE_SYSTEM', 'NETWORK_SWITCH', 'PATCH_PANEL', 'PDU', 'COOLING_UNIT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PortKind" AS ENUM ('NETWORK', 'CONSOLE', 'POWER', 'STORAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PortConnector" AS ENUM ('RJ45', 'SFP', 'SFP_PLUS', 'QSFP', 'QSFP28', 'LC', 'SC', 'DB9', 'USB_A', 'USB_C', 'C13', 'C14', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PortFace" AS ENUM ('FRONT', 'REAR', 'INTERNAL');

-- CreateEnum
CREATE TYPE "public"."CableType" AS ENUM ('CAT6A', 'DAC_100G', 'DAC_40G', 'AOC_100G', 'FIBER_SM_LC', 'FIBER_MM_OM4_LC', 'POWER_C13_C14', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."LinkStatus" AS ENUM ('PLANNED', 'ACTIVE', 'FAILED', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "public"."RedundancyPlan" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "public"."SiteAssetKind" AS ENUM ('DOOR', 'COOLING', 'ODF', 'DDF', 'COLUMN', 'NOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RackSide" AS ENUM ('LEFT', 'RIGHT', 'FRONT', 'REAR', 'TOP');

-- CreateEnum
CREATE TYPE "public"."DocEntityType" AS ENUM ('DATACENTER', 'RACK', 'PROJECT', 'COMPONENT', 'PORT', 'LIAISON');

-- DropForeignKey
ALTER TABLE "public"."Component" DROP CONSTRAINT "Component_uniteId_fkey";

-- AlterTable
ALTER TABLE "public"."Component" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "datacenterId" TEXT,
ADD COLUMN     "layer" "public"."ComponentLayer" NOT NULL DEFAULT 'PHYSICAL',
ADD COLUMN     "modelId" TEXT,
ADD COLUMN     "rackId" INTEGER,
ADD COLUMN     "rackSide" "public"."RackSide",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "uniteId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Liaison" ADD COLUMN     "cableTypeId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "longueurM" DOUBLE PRECISION,
ADD COLUMN     "plan" "public"."RedundancyPlan",
ADD COLUMN     "refCode" TEXT,
ADD COLUMN     "status" "public"."LinkStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "type" "public"."CableType",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "vitesse" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Port" DROP COLUMN "forme",
DROP COLUMN "type",
ADD COLUMN     "connector" "public"."PortConnector" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "face" "public"."PortFace",
ADD COLUMN     "index" INTEGER,
ADD COLUMN     "kind" "public"."PortKind" NOT NULL DEFAULT 'NETWORK',
ADD COLUMN     "media" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "poe" BOOLEAN,
ADD COLUMN     "speedMbps" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Rack" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "datacenterId" TEXT,
ADD COLUMN     "posCol" INTEGER,
ADD COLUMN     "posRow" INTEGER,
ADD COLUMN     "rackModelId" TEXT,
ADD COLUMN     "rotationDeg" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."OrgType" NOT NULL,
    "country" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contact" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT,
    "orgId" TEXT NOT NULL,
    "emails" TEXT[],
    "phones" TEXT[],
    "preferredChannel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Datacenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "siteName" TEXT,
    "address" TEXT,
    "visitDate" TIMESTAMP(3),
    "acVoltage" TEXT,
    "phases" TEXT,
    "frequency" INTEGER,
    "coolingType" TEXT,
    "coolingUnits" INTEGER,
    "powerPlant" BOOLEAN,
    "groundingType" TEXT,
    "hasGenerator" BOOLEAN,
    "hasFireExt" BOOLEAN,
    "hasEmergencyLight" BOOLEAN,
    "hasSecurity" BOOLEAN,
    "hasToilets" BOOLEAN,
    "planUrl" TEXT,
    "gridRows" INTEGER,
    "gridCols" INTEGER,
    "gridCellSizeMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Datacenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SiteAsset" (
    "id" TEXT NOT NULL,
    "datacenterId" TEXT NOT NULL,
    "kind" "public"."SiteAssetKind" NOT NULL,
    "label" TEXT,
    "posRow" INTEGER,
    "posCol" INTEGER,
    "spanRows" INTEGER,
    "spanCols" INTEGER,
    "rotationDeg" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RackModel" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "modelRef" TEXT NOT NULL,
    "sku" TEXT,
    "uHeight" INTEGER NOT NULL,
    "heightMm" INTEGER,
    "widthMm" INTEGER,
    "depthMm" INTEGER,
    "staticLoadKg" INTEGER,
    "dynamicLoadKg" INTEGER,
    "frontDoorStyle" "public"."RackDoorStyle",
    "rearDoorStyle" "public"."RackDoorStyle",
    "doorOpenAreaPct" INTEGER,
    "color" "public"."RackColor",
    "warrantyYears" INTEGER,
    "shockPalletSupported" BOOLEAN,
    "shipPreconfiguredOk" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RackModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhysicalComponentModel" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "function" "public"."PhysicalFunction" NOT NULL,
    "ports" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalComponentModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PortTemplate" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "fixedName" TEXT,
    "namePrefix" TEXT,
    "startIndex" INTEGER,
    "endIndex" INTEGER,
    "face" "public"."PortFace",
    "kind" "public"."PortKind" NOT NULL DEFAULT 'NETWORK',
    "connector" "public"."PortConnector" NOT NULL DEFAULT 'OTHER',
    "speedMbps" INTEGER,
    "poe" BOOLEAN,
    "media" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CableTypeRef" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "vendor" TEXT,
    "category" "public"."CableType",
    "defaultSpeed" TEXT,
    "defaultLengthM" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CableTypeRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "clientOrgId" TEXT NOT NULL,
    "datacenterId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectAlias" (
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAlias_pkey" PRIMARY KEY ("projectId","key")
);

-- CreateTable
CREATE TABLE "public"."ProjectContact" (
    "projectId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "public"."ProjectContactRole" NOT NULL,
    "scope" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectContact_pkey" PRIMARY KEY ("projectId","contactId","role")
);

-- CreateTable
CREATE TABLE "public"."DatacenterContact" (
    "datacenterId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "public"."DatacenterContactRole" NOT NULL,
    "availability" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatacenterContact_pkey" PRIMARY KEY ("datacenterId","contactId","role")
);

-- CreateTable
CREATE TABLE "public"."ProjectRack" (
    "projectId" TEXT NOT NULL,
    "rackId" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRack_pkey" PRIMARY KEY ("projectId","rackId")
);

-- CreateTable
CREATE TABLE "public"."ChangeLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userEmail" TEXT,
    "diffJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_LogicalOnPhysical" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_LogicalOnPhysical_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "public"."Organization"("name");

-- CreateIndex
CREATE INDEX "Contact_orgId_idx" ON "public"."Contact"("orgId");

-- CreateIndex
CREATE INDEX "Contact_fullName_idx" ON "public"."Contact"("fullName");

-- CreateIndex
CREATE INDEX "SiteAsset_datacenterId_kind_idx" ON "public"."SiteAsset"("datacenterId", "kind");

-- CreateIndex
CREATE INDEX "PortTemplate_modelId_idx" ON "public"."PortTemplate"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "CableTypeRef_code_key" ON "public"."CableTypeRef"("code");

-- CreateIndex
CREATE INDEX "CableTypeRef_code_idx" ON "public"."CableTypeRef"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "public"."Project"("code");

-- CreateIndex
CREATE INDEX "ProjectContact_contactId_idx" ON "public"."ProjectContact"("contactId");

-- CreateIndex
CREATE INDEX "DatacenterContact_contactId_idx" ON "public"."DatacenterContact"("contactId");

-- CreateIndex
CREATE INDEX "ProjectRack_rackId_idx" ON "public"."ProjectRack"("rackId");

-- CreateIndex
CREATE INDEX "_LogicalOnPhysical_B_index" ON "public"."_LogicalOnPhysical"("B");

-- CreateIndex
CREATE INDEX "Liaison_cableTypeId_idx" ON "public"."Liaison"("cableTypeId");

-- CreateIndex
CREATE INDEX "Port_componentId_idx" ON "public"."Port"("componentId");

-- CreateIndex
CREATE INDEX "Rack_datacenterId_idx" ON "public"."Rack"("datacenterId");

-- CreateIndex
CREATE UNIQUE INDEX "Rack_datacenterId_nom_key" ON "public"."Rack"("datacenterId", "nom");

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SiteAsset" ADD CONSTRAINT "SiteAsset_datacenterId_fkey" FOREIGN KEY ("datacenterId") REFERENCES "public"."Datacenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rack" ADD CONSTRAINT "Rack_datacenterId_fkey" FOREIGN KEY ("datacenterId") REFERENCES "public"."Datacenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rack" ADD CONSTRAINT "Rack_rackModelId_fkey" FOREIGN KEY ("rackModelId") REFERENCES "public"."RackModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PortTemplate" ADD CONSTRAINT "PortTemplate_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "public"."PhysicalComponentModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Component" ADD CONSTRAINT "Component_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "public"."Rack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Component" ADD CONSTRAINT "Component_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "public"."Unite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Component" ADD CONSTRAINT "Component_datacenterId_fkey" FOREIGN KEY ("datacenterId") REFERENCES "public"."Datacenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Component" ADD CONSTRAINT "Component_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "public"."PhysicalComponentModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Liaison" ADD CONSTRAINT "Liaison_cableTypeId_fkey" FOREIGN KEY ("cableTypeId") REFERENCES "public"."CableTypeRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_clientOrgId_fkey" FOREIGN KEY ("clientOrgId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_datacenterId_fkey" FOREIGN KEY ("datacenterId") REFERENCES "public"."Datacenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectAlias" ADD CONSTRAINT "ProjectAlias_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectContact" ADD CONSTRAINT "ProjectContact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectContact" ADD CONSTRAINT "ProjectContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DatacenterContact" ADD CONSTRAINT "DatacenterContact_datacenterId_fkey" FOREIGN KEY ("datacenterId") REFERENCES "public"."Datacenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DatacenterContact" ADD CONSTRAINT "DatacenterContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectRack" ADD CONSTRAINT "ProjectRack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectRack" ADD CONSTRAINT "ProjectRack_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "public"."Rack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LogicalOnPhysical" ADD CONSTRAINT "_LogicalOnPhysical_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LogicalOnPhysical" ADD CONSTRAINT "_LogicalOnPhysical_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

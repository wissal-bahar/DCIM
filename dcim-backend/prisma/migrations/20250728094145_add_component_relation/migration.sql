-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('serveur_rackable', 'serveur_lame', 'vMSC', 'vCU', 'vDU', 'switch', 'routeur', 'firewall', 'load_balancer', 'dns_dhcp', 'nas', 'san', 'controleur_stockage');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('actif', 'inactif', 'en_panne', 'maintenance');

-- CreateTable
CREATE TABLE "Unite" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "rackId" INTEGER NOT NULL,

    CONSTRAINT "Unite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "modele" TEXT NOT NULL,
    "statut" "ComponentStatus" NOT NULL,
    "description" TEXT,
    "uniteId" INTEGER NOT NULL,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Port" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "forme" TEXT,
    "componentId" INTEGER NOT NULL,

    CONSTRAINT "Port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liaison" (
    "id" SERIAL NOT NULL,
    "portAId" INTEGER NOT NULL,
    "portBId" INTEGER NOT NULL,
    "vitesse" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Liaison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Component_uniteId_key" ON "Component"("uniteId");

-- CreateIndex
CREATE UNIQUE INDEX "Liaison_portAId_key" ON "Liaison"("portAId");

-- CreateIndex
CREATE UNIQUE INDEX "Liaison_portBId_key" ON "Liaison"("portBId");

-- AddForeignKey
ALTER TABLE "Unite" ADD CONSTRAINT "Unite_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "Unite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Port" ADD CONSTRAINT "Port_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liaison" ADD CONSTRAINT "Liaison_portAId_fkey" FOREIGN KEY ("portAId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liaison" ADD CONSTRAINT "Liaison_portBId_fkey" FOREIGN KEY ("portBId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

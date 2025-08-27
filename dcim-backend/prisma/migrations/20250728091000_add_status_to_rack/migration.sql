-- CreateEnum
CREATE TYPE "RackStatus" AS ENUM ('prototype', 'en_marche', 'en_arret');

-- CreateTable
CREATE TABLE "Rack" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "localisation" TEXT NOT NULL,
    "nbUnites" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RackStatus" NOT NULL DEFAULT 'prototype',

    CONSTRAINT "Rack_pkey" PRIMARY KEY ("id")
);

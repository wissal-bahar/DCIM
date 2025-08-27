-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."AccessRequest" ADD COLUMN     "handledAt" TIMESTAMP(3),
ADD COLUMN     "handledBy" TEXT,
ADD COLUMN     "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING';

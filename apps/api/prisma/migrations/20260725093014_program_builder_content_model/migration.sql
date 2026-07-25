-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "ProgramCoverStyle" AS ENUM ('gradient', 'geometric');

-- CreateEnum
CREATE TYPE "ModuleUnlockMode" AS ENUM ('hidden', 'immediate', 'after_previous', 'after_days');

-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "description" TEXT,
ADD COLUMN     "unlock_days" INTEGER,
ADD COLUMN     "unlock_mode" "ModuleUnlockMode" NOT NULL DEFAULT 'immediate';

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "cover_style" "ProgramCoverStyle" NOT NULL DEFAULT 'gradient',
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "status" "ProgramStatus" NOT NULL DEFAULT 'draft';

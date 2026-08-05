-- Add new documentation fields
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "documentationLinkToken" TEXT;
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "documentationFiles" JSONB;
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "documentationStatus" TEXT;

-- Add exam fields (rename existing)
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "asoFile" TEXT;
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "asoStatus" TEXT;

-- Add Onvio fields
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "onvioLaunched" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "onvioConfirmedAt" TIMESTAMP(3);

-- Add Benefits fields
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "cajuRegistered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "metocarRegistered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "urbisRegistered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "benefitsCompletedAt" TIMESTAMP(3);

-- Remove old columns if they exist
ALTER TABLE "RecruitmentCandidate" DROP COLUMN IF EXISTS "admissionStatus";
ALTER TABLE "RecruitmentCandidate" DROP COLUMN IF EXISTS "admissionDocuments";
ALTER TABLE "RecruitmentCandidate" DROP COLUMN IF EXISTS "admissionAsoFile";
ALTER TABLE "RecruitmentCandidate" DROP COLUMN IF EXISTS "admissionAsoStatus";

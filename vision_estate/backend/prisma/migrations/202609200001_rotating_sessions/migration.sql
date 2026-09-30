-- Additive migration: legacy sessions retain their original bounded lifetime.
ALTER TABLE "Session" ADD COLUMN "familyId" TEXT,
  ADD COLUMN "consumedAt" TIMESTAMP(3), ADD COLUMN "revokedAt" TIMESTAMP(3);
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

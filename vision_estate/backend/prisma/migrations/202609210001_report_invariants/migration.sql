-- Additive: old records are preserved. Existing reviewed leads need to review
-- the specific full report once before its first release under the new gate.
ALTER TABLE "Report" ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3), ADD COLUMN "valuationId" TEXT;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_valuationId_fkey"
  FOREIGN KEY ("valuationId") REFERENCES "Valuation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Existing legacy release attribution is preserved; all new writes are checked.
ALTER TABLE "Report" ADD CONSTRAINT "Report_releasedByUserId_fkey"
  FOREIGN KEY ("releasedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

CREATE FUNCTION ve_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Evidence records are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER consent_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON "Consent"
  FOR EACH STATEMENT EXECUTE FUNCTION ve_append_only();
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION ve_append_only();

CREATE FUNCTION ve_report_invariants() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  lead_record RECORD;
  actor_record RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."reviewedAt" IS NOT NULL OR OLD."releaseState" = 'RELEASED' THEN
      RAISE EXCEPTION 'Reviewed reports are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId"
      OR NEW.tier IS DISTINCT FROM OLD.tier OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
      RAISE EXCEPTION 'Report identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."reviewedAt" IS NOT NULL AND
      (NEW.payload IS DISTINCT FROM OLD.payload OR NEW."valuationId" IS DISTINCT FROM OLD."valuationId"
       OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt" OR NEW."reviewedByUserId" IS DISTINCT FROM OLD."reviewedByUserId") THEN
      RAISE EXCEPTION 'Reviewed report content is immutable; create a new version' USING ERRCODE = '23514';
    END IF;
    IF OLD."releaseState" = 'RELEASED' AND
      (NEW."releaseState" IS DISTINCT FROM OLD."releaseState" OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW."releasedAt" IS DISTINCT FROM OLD."releasedAt" OR NEW."releasedByUserId" IS DISTINCT FROM OLD."releasedByUserId") THEN
      RAISE EXCEPTION 'Report release is irreversible' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."valuationId" IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM "Valuation" WHERE id = NEW."valuationId" AND "propertyId" = NEW."propertyId") THEN
    RAISE EXCEPTION 'Valuation belongs to another property' USING ERRCODE = '23514';
  END IF;
  IF (NEW."reviewedAt" IS NULL) <> (NEW."reviewedByUserId" IS NULL) THEN
    RAISE EXCEPTION 'Review needs a reviewer and timestamp' USING ERRCODE = '23514';
  END IF;
  IF NEW."reviewedAt" IS NOT NULL AND (TG_OP = 'INSERT' OR OLD."reviewedAt" IS NULL) THEN
    SELECT * INTO lead_record FROM "Lead" WHERE "propertyId" = NEW."propertyId" FOR UPDATE;
    SELECT * INTO actor_record FROM "User" WHERE id = NEW."reviewedByUserId";
    IF NEW.tier <> 'FULL' OR lead_record.id IS NULL OR lead_record."reviewedAt" IS NULL
      OR lead_record."reviewedByUserId" IS DISTINCT FROM NEW."reviewedByUserId"
      OR actor_record.id IS NULL OR NOT actor_record.active
      OR (actor_record.role <> 'ADMIN' AND lead_record."assignedToId" IS DISTINCT FROM actor_record.id) THEN
      RAISE EXCEPTION 'Report review requires the authorized broker case review' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.tier = 'FULL' AND NEW."releaseState" = 'SELLER_VISIBLE' THEN
    RAISE EXCEPTION 'Full reports require explicit release' USING ERRCODE = '23514';
  END IF;
  IF NEW."releaseState" = 'RELEASED' AND (TG_OP = 'INSERT' OR OLD."releaseState" <> 'RELEASED') THEN
    SELECT * INTO lead_record FROM "Lead" WHERE "propertyId" = NEW."propertyId" FOR UPDATE;
    SELECT * INTO actor_record FROM "User" WHERE id = NEW."releasedByUserId";
    IF NEW.tier <> 'FULL' OR NEW."reviewedAt" IS NULL OR NEW."releasedAt" IS NULL
      OR NEW."releasedAt" < NEW."reviewedAt" OR lead_record."reviewedByUserId" IS NULL
      OR lead_record."reviewedAt" IS NULL OR actor_record.id IS NULL OR NOT actor_record.active
      OR (actor_record.role <> 'ADMIN' AND lead_record."assignedToId" IS DISTINCT FROM actor_record.id)
      OR NOT EXISTS (SELECT 1 FROM "Property" WHERE id = NEW."propertyId" AND state = 'REPORT_READY') THEN
      RAISE EXCEPTION 'Full report release requires an authorized, recorded review' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER report_invariants BEFORE INSERT OR UPDATE OR DELETE ON "Report"
  FOR EACH ROW EXECUTE FUNCTION ve_report_invariants();

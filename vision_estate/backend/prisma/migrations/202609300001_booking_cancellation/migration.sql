-- Blueprint §2.2: cancel a consultation without deleting its history.
-- Unconfirmed requests release the slot. A confirmed calendar event stays held
-- until a broker records reconciliation. Existing rows keep their slot.
ALTER TABLE "Booking" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "slotStartsAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "slotEndsAt" TIMESTAMP(3);
ALTER TABLE "Booking" ALTER COLUMN "slotId" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'LAND');

-- CreateEnum
CREATE TYPE "PropertyCondition" AS ENUM ('NEW', 'GOOD', 'NEEDS_RENOVATION');

-- CreateEnum
CREATE TYPE "PropertyState" AS ENUM ('DRAFT', 'SUBMITTED', 'VALUATION_PENDING', 'VALUATION_RECEIVED', 'REPORT_READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReportTier" AS ENUM ('VALUE_SIGNAL', 'FULL');

-- CreateEnum
CREATE TYPE "ReportReleaseState" AS ENUM ('DRAFT_INTERNAL', 'SELLER_VISIBLE', 'UNDER_BROKER_REVIEW', 'RELEASED');

-- CreateEnum
CREATE TYPE "SubscriptionState" AS ENUM ('NONE', 'PENDING', 'CONFIRMED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('NEWSLETTER', 'TERMS', 'DATA_PROCESSING');

-- CreateEnum
CREATE TYPE "ConsentAction" AS ENUM ('GRANTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ScoreBand" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "sizeSqm" DOUBLE PRECISION NOT NULL,
    "condition" "PropertyCondition" NOT NULL,
    "yearBuilt" INTEGER NOT NULL,
    "sellerContact" JSONB NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'de-DE',
    "state" "PropertyState" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PriceHubble',
    "rawResponse" JSONB NOT NULL,
    "estimatedValue" DOUBLE PRECISION NOT NULL,
    "lowRange" DOUBLE PRECISION NOT NULL,
    "highRange" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tier" "ReportTier" NOT NULL,
    "releaseState" "ReportReleaseState" NOT NULL DEFAULT 'DRAFT_INTERNAL',
    "payload" JSONB NOT NULL,
    "releasedByUserId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "scoreBand" "ScoreBand" DEFAULT 'HOT',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "state" "SubscriptionState" NOT NULL DEFAULT 'PENDING',
    "confirmTokenHash" TEXT,
    "confirmTokenExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "consentType" "ConsentType" NOT NULL,
    "action" "ConsentAction" NOT NULL,
    "source" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_state_idx" ON "Property"("state");

-- CreateIndex
CREATE INDEX "Valuation_propertyId_idx" ON "Valuation"("propertyId");

-- CreateIndex
CREATE INDEX "Report_propertyId_tier_releaseState_idx" ON "Report"("propertyId", "tier", "releaseState");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_propertyId_key" ON "Lead"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscription_email_key" ON "NewsletterSubscription"("email");

-- CreateIndex
CREATE INDEX "NewsletterSubscription_state_confirmTokenExpiresAt_idx" ON "NewsletterSubscription"("state", "confirmTokenExpiresAt");

-- CreateIndex
CREATE INDEX "Consent_userId_consentType_idx" ON "Consent"("userId", "consentType");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

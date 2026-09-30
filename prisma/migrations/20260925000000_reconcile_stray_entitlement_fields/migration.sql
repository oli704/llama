-- Reconcile databases that already had an out-of-tree migration applied
-- ("20260924091107_add_stripe_subscription_fields", never committed), which added
-- subscription fields directly to "Entitlement". Subscription state now lives in
-- the "Subscription" table (next migration), so remove those fields. Every
-- statement is a no-op on a database that never had that migration.

-- DropIndex (recreated by the next migration)
DROP INDEX IF EXISTS "Entitlement_userId_type_key";
DROP INDEX IF EXISTS "Entitlement_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "Entitlement" DROP COLUMN IF EXISTS "currentPeriodEnd",
DROP COLUMN IF EXISTS "status",
DROP COLUMN IF EXISTS "stripeCustomerId",
DROP COLUMN IF EXISTS "stripeSubscriptionId",
DROP COLUMN IF EXISTS "updatedAt";

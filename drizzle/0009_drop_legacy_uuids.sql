-- Contract step of 0008_numeric_ids: drops the uuid columns nothing reads
-- any more (the legacy_*_uuid FKs, and `uuid` on tables the POS never writes
-- offline). sales / workers / audit_events keep `uuid`: the offline sync's
-- idempotency key.
-- Destructive. Backup taken right before: backups/pre-0009_2026-09-30/.
-- Once applied, drizzle/rollback/0008_down.sql no longer works.

SET LOCAL lock_timeout = '10s';--> statement-breakpoint
SET LOCAL idle_in_transaction_session_timeout = '15s';--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT "categories_uuid_unique";--> statement-breakpoint
ALTER TABLE "discount_policies" DROP CONSTRAINT "discount_policies_uuid_unique";--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_uuid_unique";--> statement-breakpoint
ALTER TABLE "loyalty_ledger" DROP CONSTRAINT "loyalty_ledger_uuid_unique";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_uuid_unique";--> statement-breakpoint
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_uuid_unique";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_uuid_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_uuid_unique";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "legacy_user_id_uuid";--> statement-breakpoint
ALTER TABLE "audit_events" DROP COLUMN "legacy_actor_id_uuid";--> statement-breakpoint
ALTER TABLE "audit_events" DROP COLUMN "legacy_worker_id_uuid";--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "uuid";--> statement-breakpoint
ALTER TABLE "discount_policies" DROP COLUMN "uuid";--> statement-breakpoint
ALTER TABLE "discount_policies" DROP COLUMN "legacy_created_by_uuid";--> statement-breakpoint
ALTER TABLE "locations" DROP COLUMN "uuid";--> statement-breakpoint
ALTER TABLE "loyalty_ledger" DROP COLUMN "uuid";--> statement-breakpoint
ALTER TABLE "loyalty_ledger" DROP COLUMN "legacy_worker_id_uuid";--> statement-breakpoint
ALTER TABLE "loyalty_ledger" DROP COLUMN "legacy_sale_id_uuid";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "uuid";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "legacy_category_id_uuid";--> statement-breakpoint
ALTER TABLE "sale_items" DROP COLUMN "uuid";--> statement-breakpoint
ALTER TABLE "sale_items" DROP COLUMN "legacy_sale_id_uuid";--> statement-breakpoint
ALTER TABLE "sale_items" DROP COLUMN "legacy_product_id_uuid";--> statement-breakpoint
ALTER TABLE "sales" DROP COLUMN "legacy_cashier_id_uuid";--> statement-breakpoint
ALTER TABLE "sales" DROP COLUMN "legacy_courtesy_approved_by_uuid";--> statement-breakpoint
ALTER TABLE "sales" DROP COLUMN "legacy_worker_id_uuid";--> statement-breakpoint
ALTER TABLE "sales" DROP COLUMN "legacy_policy_id_uuid";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "legacy_user_id_uuid";--> statement-breakpoint
ALTER TABLE "stock_levels" DROP COLUMN "legacy_product_id_uuid";--> statement-breakpoint
ALTER TABLE "stock_levels" DROP COLUMN "legacy_location_id_uuid";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP COLUMN "uuid";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP COLUMN "legacy_product_id_uuid";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP COLUMN "legacy_location_id_uuid";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP COLUMN "legacy_actor_id_uuid";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "uuid";--> statement-breakpoint
ALTER TABLE "workers" DROP COLUMN "legacy_registered_by_uuid";--> statement-breakpoint
ALTER TABLE "workers" DROP COLUMN "legacy_approved_by_uuid";
-- OBSOLETE since 0009_drop_legacy_uuids: it needs the uuid / legacy_*_uuid
-- columns that 0009 dropped. Restoring those means reloading them from
-- backups/pre-0009_2026-09-30/.
--
-- Rollback of 0008_numeric_ids: back to uuid primary keys, keeping every row
-- (including rows created after 0008: their uuid FKs are rebuilt from the
-- numeric ones before those are dropped).
--
-- Not a drizzle migration; run by hand, in one transaction:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f drizzle/rollback/0008_down.sql
-- then revert the code and drop the 0008 entry from drizzle/meta/_journal.json.

-- 1. Rebuild the legacy uuid FKs from the numeric ones.
UPDATE "accounts" c SET "legacy_user_id_uuid" = p."uuid" FROM "users" p WHERE p."id_user" = c."id_user";
UPDATE "sessions" c SET "legacy_user_id_uuid" = p."uuid" FROM "users" p WHERE p."id_user" = c."id_user";
UPDATE "products" c SET "legacy_category_id_uuid" = p."uuid" FROM "categories" p WHERE p."id_category" = c."id_category";
UPDATE "workers" c SET "legacy_registered_by_uuid" = p."uuid" FROM "users" p WHERE p."id_user" = c."registered_by";
UPDATE "workers" c SET "legacy_approved_by_uuid" = p."uuid" FROM "users" p WHERE p."id_user" = c."approved_by";
UPDATE "discount_policies" c SET "legacy_created_by_uuid" = p."uuid" FROM "users" p WHERE p."id_user" = c."created_by";
UPDATE "sales" c SET "legacy_cashier_id_uuid" = p."uuid" FROM "users" p WHERE p."id_user" = c."id_cashier";
UPDATE "sales" c SET "legacy_courtesy_approved_by_uuid" = p."uuid" FROM "users" p WHERE p."id_user" = c."courtesy_approved_by";
UPDATE "sales" c SET "legacy_worker_id_uuid" = p."uuid" FROM "workers" p WHERE p."id_worker" = c."id_worker";
UPDATE "sales" c SET "legacy_policy_id_uuid" = p."uuid" FROM "discount_policies" p WHERE p."id_policy" = c."id_policy";
UPDATE "sale_items" c SET "legacy_sale_id_uuid" = p."uuid" FROM "sales" p WHERE p."id_sale" = c."id_sale";
UPDATE "sale_items" c SET "legacy_product_id_uuid" = p."uuid" FROM "products" p WHERE p."id_product" = c."id_product";
UPDATE "stock_levels" c SET "legacy_product_id_uuid" = p."uuid" FROM "products" p WHERE p."id_product" = c."id_product";
UPDATE "stock_levels" c SET "legacy_location_id_uuid" = p."uuid" FROM "locations" p WHERE p."id_location" = c."id_location";
UPDATE "stock_movements" c SET "legacy_product_id_uuid" = p."uuid" FROM "products" p WHERE p."id_product" = c."id_product";
UPDATE "stock_movements" c SET "legacy_location_id_uuid" = p."uuid" FROM "locations" p WHERE p."id_location" = c."id_location";
UPDATE "stock_movements" c SET "legacy_actor_id_uuid" = p."uuid" FROM "users" p WHERE p."id_user" = c."id_actor";
UPDATE "loyalty_ledger" c SET "legacy_worker_id_uuid" = p."uuid" FROM "workers" p WHERE p."id_worker" = c."id_worker";
UPDATE "loyalty_ledger" c SET "legacy_sale_id_uuid" = p."uuid" FROM "sales" p WHERE p."id_sale" = c."id_sale";
UPDATE "audit_events" c SET "legacy_actor_id_uuid" = p."uuid" FROM "users" p WHERE p."id_user" = c."id_actor";
UPDATE "audit_events" c SET "legacy_worker_id_uuid" = p."uuid" FROM "workers" p WHERE p."id_worker" = c."id_worker";

-- 2. Drop the numeric FK columns (their constraints and indexes go with them).
ALTER TABLE "stock_levels" DROP CONSTRAINT "stock_levels_id_product_id_location_pk";
ALTER TABLE "accounts" DROP COLUMN "id_user";
ALTER TABLE "sessions" DROP COLUMN "id_user";
ALTER TABLE "products" DROP COLUMN "id_category";
ALTER TABLE "workers" DROP COLUMN "registered_by";
ALTER TABLE "workers" DROP COLUMN "approved_by";
ALTER TABLE "discount_policies" DROP COLUMN "created_by";
ALTER TABLE "sales" DROP COLUMN "id_cashier";
ALTER TABLE "sales" DROP COLUMN "courtesy_approved_by";
ALTER TABLE "sales" DROP COLUMN "id_worker";
ALTER TABLE "sales" DROP COLUMN "id_policy";
ALTER TABLE "sale_items" DROP COLUMN "id_sale";
ALTER TABLE "sale_items" DROP COLUMN "id_product";
ALTER TABLE "stock_levels" DROP COLUMN "id_product";
ALTER TABLE "stock_levels" DROP COLUMN "id_location";
ALTER TABLE "stock_movements" DROP COLUMN "id_product";
ALTER TABLE "stock_movements" DROP COLUMN "id_location";
ALTER TABLE "stock_movements" DROP COLUMN "id_actor";
ALTER TABLE "loyalty_ledger" DROP COLUMN "id_worker";
ALTER TABLE "loyalty_ledger" DROP COLUMN "id_sale";
ALTER TABLE "audit_events" DROP COLUMN "id_actor";
ALTER TABLE "audit_events" DROP COLUMN "id_worker";

-- 3. Legacy columns back to their original names.
ALTER TABLE "accounts" RENAME COLUMN "legacy_user_id_uuid" TO "user_id";
ALTER TABLE "sessions" RENAME COLUMN "legacy_user_id_uuid" TO "user_id";
ALTER TABLE "products" RENAME COLUMN "legacy_category_id_uuid" TO "category_id";
ALTER TABLE "workers" RENAME COLUMN "legacy_registered_by_uuid" TO "registered_by";
ALTER TABLE "workers" RENAME COLUMN "legacy_approved_by_uuid" TO "approved_by";
ALTER TABLE "discount_policies" RENAME COLUMN "legacy_created_by_uuid" TO "created_by";
ALTER TABLE "sales" RENAME COLUMN "legacy_cashier_id_uuid" TO "cashier_id";
ALTER TABLE "sales" RENAME COLUMN "legacy_courtesy_approved_by_uuid" TO "courtesy_approved_by";
ALTER TABLE "sales" RENAME COLUMN "legacy_worker_id_uuid" TO "worker_id";
ALTER TABLE "sales" RENAME COLUMN "legacy_policy_id_uuid" TO "policy_id";
ALTER TABLE "sale_items" RENAME COLUMN "legacy_sale_id_uuid" TO "sale_id";
ALTER TABLE "sale_items" RENAME COLUMN "legacy_product_id_uuid" TO "product_id";
ALTER TABLE "stock_levels" RENAME COLUMN "legacy_product_id_uuid" TO "product_id";
ALTER TABLE "stock_levels" RENAME COLUMN "legacy_location_id_uuid" TO "location_id";
ALTER TABLE "stock_movements" RENAME COLUMN "legacy_product_id_uuid" TO "product_id";
ALTER TABLE "stock_movements" RENAME COLUMN "legacy_location_id_uuid" TO "location_id";
ALTER TABLE "stock_movements" RENAME COLUMN "legacy_actor_id_uuid" TO "actor_id";
ALTER TABLE "loyalty_ledger" RENAME COLUMN "legacy_worker_id_uuid" TO "worker_id";
ALTER TABLE "loyalty_ledger" RENAME COLUMN "legacy_sale_id_uuid" TO "sale_id";
ALTER TABLE "audit_events" RENAME COLUMN "legacy_actor_id_uuid" TO "actor_id";
ALTER TABLE "audit_events" RENAME COLUMN "legacy_worker_id_uuid" TO "worker_id";
ALTER TABLE "audit_events" RENAME COLUMN "sale_uuid" TO "sale_id";
ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "sales" ALTER COLUMN "cashier_id" SET NOT NULL;
ALTER TABLE "sale_items" ALTER COLUMN "sale_id" SET NOT NULL;
ALTER TABLE "sale_items" ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "stock_levels" ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "stock_levels" ALTER COLUMN "location_id" SET NOT NULL;
ALTER TABLE "stock_movements" ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "stock_movements" ALTER COLUMN "location_id" SET NOT NULL;
ALTER TABLE "loyalty_ledger" ALTER COLUMN "worker_id" SET NOT NULL;

-- 4. uuid primary keys again (dropping the PK column drops its identity too).
ALTER TABLE "users" DROP COLUMN "id_user";
ALTER TABLE "users" DROP CONSTRAINT "users_uuid_unique";
ALTER TABLE "users" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
ALTER TABLE "categories" DROP COLUMN "id_category";
ALTER TABLE "categories" DROP CONSTRAINT "categories_uuid_unique";
ALTER TABLE "categories" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "categories" ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");
ALTER TABLE "products" DROP COLUMN "id_product";
ALTER TABLE "products" DROP CONSTRAINT "products_uuid_unique";
ALTER TABLE "products" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "products" ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");
ALTER TABLE "workers" DROP COLUMN "id_worker";
ALTER TABLE "workers" DROP CONSTRAINT "workers_uuid_unique";
ALTER TABLE "workers" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "workers" ADD CONSTRAINT "workers_pkey" PRIMARY KEY ("id");
ALTER TABLE "discount_policies" DROP COLUMN "id_policy";
ALTER TABLE "discount_policies" DROP CONSTRAINT "discount_policies_uuid_unique";
ALTER TABLE "discount_policies" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "discount_policies" ADD CONSTRAINT "discount_policies_pkey" PRIMARY KEY ("id");
ALTER TABLE "sales" DROP COLUMN "id_sale";
ALTER TABLE "sales" DROP CONSTRAINT "sales_uuid_unique";
ALTER TABLE "sales" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "sales" ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");
ALTER TABLE "sale_items" DROP COLUMN "id_sale_item";
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_uuid_unique";
ALTER TABLE "sale_items" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id");
ALTER TABLE "locations" DROP COLUMN "id_location";
ALTER TABLE "locations" DROP CONSTRAINT "locations_uuid_unique";
ALTER TABLE "locations" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "locations" ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");
ALTER TABLE "stock_movements" DROP COLUMN "id_movement";
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_uuid_unique";
ALTER TABLE "stock_movements" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");
ALTER TABLE "loyalty_ledger" DROP COLUMN "id_loyalty";
ALTER TABLE "loyalty_ledger" DROP CONSTRAINT "loyalty_ledger_uuid_unique";
ALTER TABLE "loyalty_ledger" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_pkey" PRIMARY KEY ("id");
ALTER TABLE "audit_events" DROP COLUMN "id_audit";
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_uuid_unique";
ALTER TABLE "audit_events" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id");

-- 5. Original constraints and indexes (as created by 0000–0007).
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_product_id_location_id_pk" PRIMARY KEY ("product_id", "location_id");
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_sale_id_unique" UNIQUE ("sale_id");
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");
ALTER TABLE "workers" ADD CONSTRAINT "workers_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id");
ALTER TABLE "workers" ADD CONSTRAINT "workers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");
ALTER TABLE "discount_policies" ADD CONSTRAINT "discount_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id");
ALTER TABLE "sales" ADD CONSTRAINT "sales_courtesy_approved_by_users_id_fk" FOREIGN KEY ("courtesy_approved_by") REFERENCES "public"."users"("id");
ALTER TABLE "sales" ADD CONSTRAINT "sales_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id");
ALTER TABLE "sales" ADD CONSTRAINT "sales_policy_id_discount_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."discount_policies"("id");
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id");
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id");
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");
CREATE INDEX "sales_worker_created_idx" ON "sales" USING btree ("worker_id","client_created_at");
CREATE INDEX "sales_cashier_created_idx" ON "sales" USING btree ("cashier_id","client_created_at");
CREATE UNIQUE INDEX "stock_movements_ref_unique" ON "stock_movements" USING btree ("type","ref_id","product_id","location_id");
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id","created_at");
CREATE INDEX "loyalty_ledger_worker_idx" ON "loyalty_ledger" USING btree ("worker_id");
CREATE INDEX "audit_events_worker_type_idx" ON "audit_events" USING btree ("worker_id","type","occurred_at");

-- 6. Forget 0008 so `pnpm db:migrate` can apply it again.
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1790800000000;

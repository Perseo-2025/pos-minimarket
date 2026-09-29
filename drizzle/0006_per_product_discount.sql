ALTER TABLE "products" ADD COLUMN "worker_discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "is_courtesy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "courtesy_total" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "courtesy_approved_by" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_courtesy_approved_by_users_id_fk" FOREIGN KEY ("courtesy_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Data migration (hand-written): the discount used to be one global % in the
-- active policy. Carry it over to every product so nothing changes for the
-- cashier until the admin tunes it per product.
UPDATE "products"
SET "worker_discount_percent" = LEAST(p."discount_percent", 99)
FROM (
	SELECT "discount_percent" FROM "discount_policies"
	WHERE "is_active" ORDER BY "created_at" DESC LIMIT 1
) AS p;--> statement-breakpoint
-- Past discounted sales: spread the sale-level % onto their lines so the
-- per-line history is readable.
UPDATE "sale_items" AS si
SET "discount_percent" = s."discount_percent",
	"discount_amount" = round(si."line_total" * s."discount_percent" / 100, 2)
FROM "sales" AS s
WHERE si."sale_id" = s."id" AND s."discount_total" > 0;

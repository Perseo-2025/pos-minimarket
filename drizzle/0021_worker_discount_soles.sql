ALTER TYPE "public"."worker_verification" ADD VALUE 'dni_manual';--> statement-breakpoint
ALTER TABLE "discount_policies" ALTER COLUMN "discount_percent" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "discount_policies" ALTER COLUMN "max_discount_per_month" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "discount_policies" ADD COLUMN "max_discounted_units_per_sale" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_policies" ADD COLUMN "birthday_gift_max_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "worker_discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "discount_unit_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "birth_date" date;--> statement-breakpoint
-- Data migration (hand-written): the worker discount moves from a % to soles
-- per unit. Carry it over rounded to S/ 0.10 (always below the price) so the
-- admin only has to review it.
UPDATE "products"
SET "worker_discount_amount" = GREATEST(
	0,
	LEAST(round("price_sale" * "worker_discount_percent" / 100, 1), "price_sale" - 0.01)
)
WHERE "worker_discount_percent" > 0;--> statement-breakpoint
-- Past discounted lines: record the soles per unit they got.
UPDATE "sale_items"
SET "discount_unit_amount" = round("discount_amount" / "quantity", 2)
WHERE "discount_amount" > 0 AND "is_courtesy" = false;

CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "category_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_lower_unique" ON "categories" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Data migration (hand-written): turn the free-text products.category values
-- into category rows, keeping the POS order and icons used so far. Any value
-- outside the four known ones becomes its own category with a generic icon.
INSERT INTO "categories" ("name", "icon", "sort_order")
SELECT min(m."name"), min(m."icon"), min(m."sort_order")
FROM (
	SELECT
		CASE c."category"
			WHEN 'bebidas' THEN 'Bebidas'
			WHEN 'snacks' THEN 'Snacks'
			WHEN 'alimentos' THEN 'Alimentos'
			WHEN 'adornos' THEN 'Adornos'
			ELSE initcap(c."category")
		END AS "name",
		CASE WHEN c."category" IN ('bebidas', 'snacks', 'alimentos', 'adornos')
			THEN c."category" ELSE 'otros' END AS "icon",
		CASE c."category"
			WHEN 'bebidas' THEN 0
			WHEN 'snacks' THEN 1
			WHEN 'alimentos' THEN 2
			WHEN 'adornos' THEN 3
			ELSE 100
		END AS "sort_order"
	FROM (SELECT DISTINCT "category" FROM "products") AS c
) AS m
GROUP BY lower(m."name");--> statement-breakpoint
UPDATE "products" AS p
SET "category_id" = cat."id"
FROM "categories" AS cat
WHERE lower(cat."name") = lower(
	CASE p."category"
		WHEN 'bebidas' THEN 'Bebidas'
		WHEN 'snacks' THEN 'Snacks'
		WHEN 'alimentos' THEN 'Alimentos'
		WHEN 'adornos' THEN 'Adornos'
		ELSE initcap(p."category")
	END
);

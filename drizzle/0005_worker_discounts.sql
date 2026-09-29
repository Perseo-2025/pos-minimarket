CREATE TYPE "public"."loyalty_movement_type" AS ENUM('earn', 'adjust', 'reverse');--> statement-breakpoint
CREATE TYPE "public"."worker_name_source" AS ENUM('api', 'manual');--> statement-breakpoint
CREATE TYPE "public"."worker_pending_reason" AS ENUM('new', 'pin_reset');--> statement-breakpoint
CREATE TYPE "public"."worker_status" AS ENUM('pending', 'active', 'suspended', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."worker_verification" AS ENUM('none', 'pin_online', 'pin_offline');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"actor_id" uuid,
	"worker_id" uuid,
	"sale_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_percent" numeric(5, 2) NOT NULL,
	"max_discounted_sales_per_day" integer NOT NULL,
	"max_discount_per_month" numeric(10, 2) NOT NULL,
	"points_per_sol" numeric(5, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" uuid NOT NULL,
	"sale_id" uuid,
	"points" integer NOT NULL,
	"type" "loyalty_movement_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_ledger_sale_id_unique" UNIQUE("sale_id")
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dni" text NOT NULL,
	"full_name" text NOT NULL,
	"name_source" "worker_name_source" NOT NULL,
	"company" text NOT NULL,
	"pin_hash" text NOT NULL,
	"pin_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "worker_status" DEFAULT 'pending' NOT NULL,
	"pending_reason" "worker_pending_reason" DEFAULT 'new',
	"points_balance" integer DEFAULT 0 NOT NULL,
	"registered_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workers_dni_unique" UNIQUE("dni")
);
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "subtotal" numeric(10, 2);--> statement-breakpoint
-- Existing sales had no discount: their subtotal is their total.
UPDATE "sales" SET "subtotal" = "total" WHERE "subtotal" IS NULL;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "subtotal" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_total" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "worker_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "policy_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "worker_verification" "worker_verification" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "points_earned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "audit_flags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_policies" ADD CONSTRAINT "discount_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_occurred_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_worker_type_idx" ON "audit_events" USING btree ("worker_id","type","occurred_at");--> statement-breakpoint
CREATE INDEX "loyalty_ledger_worker_idx" ON "loyalty_ledger" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "workers_status_idx" ON "workers" USING btree ("status");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_policy_id_discount_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."discount_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_client_created_at_idx" ON "sales" USING btree ("client_created_at");--> statement-breakpoint
CREATE INDEX "sales_worker_created_idx" ON "sales" USING btree ("worker_id","client_created_at");--> statement-breakpoint
CREATE INDEX "sales_cashier_created_idx" ON "sales" USING btree ("cashier_id","client_created_at");
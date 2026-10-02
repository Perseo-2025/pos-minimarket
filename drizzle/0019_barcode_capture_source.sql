CREATE TYPE "public"."capture_source" AS ENUM('scan', 'manual');--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD COLUMN "capture_source" "capture_source";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "capture_source" "capture_source";--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD COLUMN "capture_source" "capture_source";--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD COLUMN "capture_source" "capture_source";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_barcode_unique" UNIQUE("barcode");
-- One-off reset (2026-10-01): wipes the test catalog and test sales so the
-- owner can start the real flow (admin → almacén → traslado → caja).
-- Not a migration: it changes data, not structure. Run in one transaction:
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -1 -f drizzle/maintenance/reset_catalog.sql
-- Kept: users, airport workers (and their audit trail), suppliers, the
-- discount policy and the Almacén/Tienda locations.
-- Backup taken first: backups/pre-reset_2026-10-01/.

SET LOCAL lock_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '15s';

-- Audit events of deleted sales/stock (worker events stay).
DELETE FROM "audit_events"
WHERE "sale_uuid" IS NOT NULL
   OR "type" IN ('sold_without_stock', 'sold_expired', 'stock_adjusted',
                 'courtesy_approved', 'courtesy_denied');

-- Catalog, stock and sales; ids start again at 1.
TRUNCATE "sale_items", "loyalty_ledger", "sales",
         "cash_movements", "cash_shifts",
         "receipt_discrepancies",
         "stock_count_items", "stock_counts",
         "goods_receipt_items", "goods_receipts",
         "purchase_order_items", "purchase_orders",
         "stock_transfer_items", "stock_transfers",
         "stock_movements", "stock_levels", "stock_lots",
         "product_presentations", "supplier_categories",
         "products", "categories"
  RESTART IDENTITY;

-- Their points came from the deleted test sales.
UPDATE "workers" SET "points_balance" = 0, "updated_at" = now();

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// Primary keys are numeric (`id_<entity>`, readable in the admin). Records
// the POS creates offline (sales, workers, audit events) also carry a
// client-generated `uuid`: the sync's idempotency key, since a tablet without
// internet can't know the next numeric id.

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "cashier",
  "warehouse",
]);
export const saleStatusEnum = pgEnum("sale_status", ["completed", "voided"]);
export const paymentTypeEnum = pgEnum("payment_type", [
  "cash",
  "yape_plin",
  "card",
]);

export const workerStatusEnum = pgEnum("worker_status", [
  "pending",
  "active",
  "suspended",
  "rejected",
]);
export const workerPendingReasonEnum = pgEnum("worker_pending_reason", [
  "new",
  "pin_reset",
]);
export const workerNameSourceEnum = pgEnum("worker_name_source", [
  "api",
  "manual",
]);
// "dni_manual" is how workers are identified today; the pin_* values remain
// on sales from when workers had a PIN.
export const workerVerificationEnum = pgEnum("worker_verification", [
  "none",
  "pin_online",
  "pin_offline",
  "dni_manual",
]);
export const loyaltyMovementTypeEnum = pgEnum("loyalty_movement_type", [
  "earn",
  "adjust",
  "reverse",
]);

export const locationKindEnum = pgEnum("location_kind", ["warehouse", "store"]);
export const cashShiftStatusEnum = pgEnum("cash_shift_status", [
  "open",
  "closed",
  "reviewed",
]);
export const cashMovementTypeEnum = pgEnum("cash_movement_type", ["in", "out"]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "pending",
  "partial",
  "received",
  "cancelled",
]);
// A product counted in the "conteo del día": matched closes on its own;
// pending waits for the admin, who approves the adjustment or asks for a
// recount (rejected).
export const countItemStatusEnum = pgEnum("count_item_status", [
  "matched",
  "pending",
  "approved",
  "rejected",
]);

// What happened with units that didn't match the invoice.
export const discrepancyStatusEnum = pgEnum("discrepancy_status", [
  "open",
  // Missing units:
  "replenished", // the supplier brought them later
  "credited", // the supplier discounted them (credit note)
  "written_off", // the store assumes the loss
  // Extra units:
  "kept", // the store keeps them
  "returned", // given back to the supplier
]);
export const receiptDocTypeEnum = pgEnum("receipt_doc_type", [
  "factura",
  "boleta",
  "guia",
  "ninguno",
]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "opening",
  "count_adjustment",
  "purchase_receipt",
  "transfer_out",
  "transfer_in",
  "sale",
  "sale_void",
  "waste",
  "supplier_return",
]);
// How a line's product was identified (barcode reader or by hand); null on
// lines recorded before the reader existed.
export const captureSourceEnum = pgEnum("capture_source", ["scan", "manual"]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "open",
  "closed",
  "missing_clock_out",
]);
export const attendanceFieldEnum = pgEnum("attendance_field", [
  "clock_in",
  "clock_out",
]);
export const attendanceCorrectionStatusEnum = pgEnum(
  "attendance_correction_status",
  ["pending", "approved", "rejected"],
);

export const users = pgTable("users", {
  id: integer("id_user").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  // Login identifier (e.g. "Ori2026") — not an email address.
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // Kept from the Auth.js User model; nullable since login is by username.
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Auth.js tables, unused with JWT sessions + credentials. They stay ready
// for a future OAuth provider without a schema migration.
export const accounts = pgTable(
  "accounts",
  {
    userId: integer("id_user")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: integer("id_user")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const categories = pgTable(
  "categories",
  {
    id: integer("id_category").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull(),
    // Key from CATEGORY_ICONS (domain); the UI maps it to an icon component.
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    // Products of this category have expiry dates (stock is kept in dated
    // lots), and how many days before expiring they are flagged.
    tracksExpiry: boolean("tracks_expiry").notNull().default(false),
    expiryWarningDays: integer("expiry_warning_days").notNull().default(30),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // "Bebidas" and "bebidas" are the same category for a cashier.
  (table) => [
    uniqueIndex("categories_name_lower_unique").on(sql`lower(${table.name})`),
  ],
);

export const products = pgTable(
  "products",
  {
    id: integer("id_product").primaryKey().generatedByDefaultAsIdentity(),
    sku: text("sku").unique(),
    // Barcode printed on the unit (what the till scans). Boxes and displays
    // carry theirs in product_presentations; no code may repeat across both.
    barcode: text("barcode").unique(),
    name: text("name").notNull(),
    description: text("description"),
    // No hard deletes: categories are deactivated, so sale history keeps
    // resolving product -> category.
    categoryId: integer("id_category")
      .notNull()
      .references(() => categories.id),
    priceSale: numeric("price_sale", { precision: 10, scale: 2 }).notNull(),
    // Soles an identified airport worker gets off each unit (always below
    // the price; only the first units of a purchase, see discount_policies).
    workerDiscountAmount: numeric("worker_discount_amount", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0"),
    // Weighted average cost per unit, recalculated on each goods receipt.
    // 4 decimals: a candy from a S/ 12 box of 144 costs 0.0833.
    priceCost: numeric("price_cost", { precision: 12, scale: 4 }),
    // Deprecated: stock lives in stock_levels, per location.
    stockQuantity: integer("stock_quantity"),
    // Set on the product's first stock count. Sales only move stock of
    // tracked products, so untracked ones never go negative by accident.
    trackStock: boolean("track_stock").notNull().default(false),
    // Overrides the category's tracks_expiry; null = follow the category.
    tracksExpiry: boolean("tracks_expiry"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("products_category_id_idx").on(table.categoryId)],
);

// Bulk packagings of a product (Display = 24 units, Caja = 6 Displays). A
// presentation contains qty_of_parent of its parent, or of the unit when it
// has none; units_total is that chain multiplied out (Caja = 144), kept in
// sync on every save. Stock is always in units: the POS sells only the unit.
export const productPresentations = pgTable(
  "product_presentations",
  {
    id: integer("id_presentation").primaryKey().generatedByDefaultAsIdentity(),
    productId: integer("id_product")
      .notNull()
      .references(() => products.id),
    name: text("name").notNull(),
    parentId: integer("id_parent_presentation"),
    qtyOfParent: integer("qty_of_parent").notNull(),
    unitsTotal: integer("units_total").notNull(),
    // Barcode printed on the box/display, for scanning at reception.
    barcode: text("barcode").unique(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Named explicitly: the generated name exceeds Postgres' 63 chars.
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "product_presentations_parent_fk",
    }),
    uniqueIndex("product_presentations_name_unique").on(
      table.productId,
      sql`lower(${table.name})`,
    ),
  ],
);

// Companies the minimarket buys from. RUC is optional (small suppliers may
// not have one) but unique when present.
export const suppliers = pgTable("suppliers", {
  id: integer("id_supplier").primaryKey().generatedByDefaultAsIdentity(),
  ruc: text("ruc").unique(),
  // Razón social, as printed on the invoice.
  businessName: text("business_name").notNull(),
  tradeName: text("trade_name"),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Which categories each supplier delivers. Many-to-many: one supplier can
// bring several categories, and one category comes from several suppliers.
export const supplierCategories = pgTable(
  "supplier_categories",
  {
    supplierId: integer("id_supplier")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    categoryId: integer("id_category")
      .notNull()
      .references(() => categories.id),
  },
  (table) => [
    primaryKey({ columns: [table.supplierId, table.categoryId] }),
    index("supplier_categories_category_idx").on(table.categoryId),
  ],
);

// Airport workers: customers entitled to the staff discount. Independent from
// `users` (the minimarket's own staff) — workers never log into the POS.
export const workers = pgTable(
  "workers",
  {
    id: integer("id_worker").primaryKey().generatedByDefaultAsIdentity(),
    // Client-generated: a registration made offline supplies its own uuid, so
    // a retried sync never registers the worker twice.
    uuid: uuid("uuid").notNull().unique().defaultRandom(),
    dni: text("dni").notNull().unique(),
    fullName: text("full_name").notNull(),
    nameSource: workerNameSourceEnum("name_source").notNull(),
    company: text("company").notNull(),
    // For the birthday gift. Null on workers registered before it was asked.
    birthDate: date("birth_date", { mode: "string" }),
    status: workerStatusEnum("status").notNull().default("pending"),
    pendingReason: workerPendingReasonEnum("pending_reason").default("new"),
    // Denormalized sum of loyalty_ledger, updated in the same transaction.
    pointsBalance: integer("points_balance").notNull().default(0),
    registeredBy: integer("registered_by").references(() => users.id),
    approvedBy: integer("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("workers_status_idx").on(table.status)],
);

// Versioned discount rules: never updated, a change inserts a new row.
export const discountPolicies = pgTable("discount_policies", {
  id: integer("id_policy").primaryKey().generatedByDefaultAsIdentity(),
  // Legacy (kept for old versions): the global % and the monthly cap.
  discountPercent: numeric("discount_percent", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("0"),
  maxDiscountedSalesPerDay: integer("max_discounted_sales_per_day").notNull(),
  maxDiscountPerMonth: numeric("max_discount_per_month", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),
  // Units of a purchase that get their product's discount (the first ones
  // in the basket).
  maxDiscountedUnitsPerSale: integer("max_discounted_units_per_sale")
    .notNull()
    .default(3),
  // Highest price of the birthday gift (0 = no gift).
  birthdayGiftMaxAmount: numeric("birthday_gift_max_amount", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),
  pointsPerSol: numeric("points_per_sol", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sales = pgTable(
  "sales",
  {
    id: integer("id_sale").primaryKey().generatedByDefaultAsIdentity(),
    // Client-generated (offline sales supply their own): the idempotency key
    // of the sync. defaultRandom()
    // is only a fallback for server-side inserts (e.g. seed).
    uuid: uuid("uuid").notNull().unique().defaultRandom(),
    cashierId: integer("id_cashier")
      .notNull()
      .references(() => users.id),
    status: saleStatusEnum("status").notNull().default("completed"),
    paymentType: paymentTypeEnum("payment_type").notNull(),
    // subtotal - discount_total - courtesy_total = total (what the customer
    // actually paid).
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    discountTotal: numeric("discount_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    // Legacy: the sale-level % from before per-product discounts.
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    // Value of the lines given away (part of subtotal, not of total): the
    // worker's birthday gift. On older sales, courtesies approved by the
    // admin in courtesy_approved_by.
    giftTotal: numeric("courtesy_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    courtesyApprovedBy: integer("courtesy_approved_by").references(
      () => users.id,
    ),
    workerId: integer("id_worker").references(() => workers.id),
    policyId: integer("id_policy").references(() => discountPolicies.id),
    workerVerification: workerVerificationEnum("worker_verification")
      .notNull()
      .default("none"),
    pointsEarned: integer("points_earned").notNull().default(0),
    // Anomalies found when the server re-priced the sale (see sale-audit.ts).
    auditFlags: text("audit_flags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // cash_shifts.uuid of the shift it was charged in. Not a foreign key: a
    // sale made offline may reach the server before its shift's opening.
    shiftUuid: uuid("shift_uuid"),
    clientCreatedAt: timestamp("client_created_at", {
      withTimezone: true,
    }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sales_client_created_at_idx").on(table.clientCreatedAt),
    index("sales_worker_created_idx").on(table.workerId, table.clientCreatedAt),
    index("sales_cashier_created_idx").on(
      table.cashierId,
      table.clientCreatedAt,
    ),
    index("sales_shift_idx").on(table.shiftUuid),
  ],
);

// A cashier's shift at the till, from "Abrir caja" to "Cerrar caja". Created
// on the device (uuid) so it works without internet. The cashier records what
// was counted; the expected amounts are computed from the shift's sales and
// cash movements, and frozen when the admin reviews it.
export const cashShifts = pgTable(
  "cash_shifts",
  {
    id: integer("id_shift").primaryKey().generatedByDefaultAsIdentity(),
    uuid: uuid("uuid").notNull().unique(),
    cashierId: integer("id_cashier")
      .notNull()
      .references(() => users.id),
    status: cashShiftStatusEnum("status").notNull().default("open"),
    // Device times.
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    openingCash: numeric("opening_cash", { precision: 10, scale: 2 }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    countedCash: numeric("counted_cash", { precision: 10, scale: 2 }),
    countedYape: numeric("counted_yape", { precision: 10, scale: 2 }),
    countedCard: numeric("counted_card", { precision: 10, scale: 2 }),
    closeNote: text("close_note"),
    // Sales the device made in the shift (to tell if some are still syncing).
    reportedSales: integer("reported_sales"),
    expectedCash: numeric("expected_cash", { precision: 10, scale: 2 }),
    expectedYape: numeric("expected_yape", { precision: 10, scale: 2 }),
    expectedCard: numeric("expected_card", { precision: 10, scale: 2 }),
    reviewedBy: integer("id_reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cash_shifts_cashier_status_idx").on(table.cashierId, table.status),
    index("cash_shifts_opened_idx").on(table.openedAt),
  ],
);

// Money put into or taken out of the drawer during a shift (paying a
// supplier in cash, change brought in, the owner taking money out).
export const cashMovements = pgTable(
  "cash_movements",
  {
    id: integer("id_cash_movement").primaryKey().generatedByDefaultAsIdentity(),
    uuid: uuid("uuid").notNull().unique(),
    // cash_shifts.uuid (no FK: it may sync before its shift's opening).
    shiftUuid: uuid("shift_uuid").notNull(),
    type: cashMovementTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdBy: integer("id_created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("cash_movements_shift_idx").on(table.shiftUuid)],
);

// Weekly work schedule of a staff member: one row per working weekday
// (0 = Sunday … 6 = Saturday). A weekday without a row is a day off. An end
// before the start means the shift ends the next day.
export const workSchedules = pgTable(
  "work_schedules",
  {
    id: integer("id_work_schedule").primaryKey().generatedByDefaultAsIdentity(),
    userId: integer("id_user")
      .notNull()
      .references(() => users.id),
    weekday: integer("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    toleranceMin: integer("tolerance_min").notNull().default(10),
    updatedBy: integer("id_updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("work_schedules_user_weekday_idx").on(table.userId, table.weekday),
  ],
);

// One workday of a staff member, from "Marcar entrada" to "Marcar salida".
// Created on the device (uuid) so it works without internet. The effective
// times (clock_in_at / clock_out_at) are what reports use; the device and
// server-received times are kept untouched as evidence. Corrections never
// overwrite silently: each one is a row in attendance_corrections.
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: integer("id_attendance").primaryKey().generatedByDefaultAsIdentity(),
    uuid: uuid("uuid").notNull().unique(),
    userId: integer("id_user")
      .notNull()
      .references(() => users.id),
    // Store-zone date of the clock-in (a night shift belongs to the day it
    // started).
    workDate: date("work_date", { mode: "string" }).notNull(),
    clockInAt: timestamp("clock_in_at", { withTimezone: true }).notNull(),
    clockInDeviceAt: timestamp("clock_in_device_at", { withTimezone: true }),
    clockInReceivedAt: timestamp("clock_in_received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
    clockOutDeviceAt: timestamp("clock_out_device_at", { withTimezone: true }),
    clockOutReceivedAt: timestamp("clock_out_received_at", { withTimezone: true }),
    // Snapshot of the schedule at clock-in: changing the schedule later must
    // not change past lateness. Null = worked on a day off.
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
    toleranceMin: integer("tolerance_min"),
    lateMinutes: integer("late_minutes").notNull().default(0),
    earlyLeaveMinutes: integer("early_leave_minutes").notNull().default(0),
    status: attendanceStatusEnum("status").notNull().default("open"),
    // Marked without internet (device time, corrected by its clock offset).
    offline: boolean("offline").notNull().default(false),
    // The device clock looked wrong or moved backwards.
    timeSuspicious: boolean("time_suspicious").notNull().default(false),
    // An approved correction changed one of the effective times.
    isCorrected: boolean("is_corrected").notNull().default(false),
    // Added by an admin (the person couldn't mark at all).
    createdBy: integer("id_created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attendance_user_date_idx").on(table.userId, table.workDate),
    index("attendance_date_idx").on(table.workDate),
    index("attendance_status_idx").on(table.status),
  ],
);

// A change to a workday's clock-in or clock-out time: requested by the
// person (forgot to mark the exit) and reviewed by an admin, or made by an
// admin directly (already approved). The original value stays here forever.
export const attendanceCorrections = pgTable(
  "attendance_corrections",
  {
    id: integer("id_attendance_correction")
      .primaryKey()
      .generatedByDefaultAsIdentity(),
    uuid: uuid("uuid").notNull().unique(),
    // attendance_records.uuid (no FK: requested offline, it may sync first).
    attendanceUuid: uuid("attendance_uuid").notNull(),
    field: attendanceFieldEnum("field").notNull(),
    oldValue: timestamp("old_value", { withTimezone: true }),
    newValue: timestamp("new_value", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    requestedBy: integer("id_requested_by")
      .notNull()
      .references(() => users.id),
    status: attendanceCorrectionStatusEnum("status").notNull().default("pending"),
    reviewedBy: integer("id_reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attendance_corrections_record_idx").on(table.attendanceUuid),
    index("attendance_corrections_status_idx").on(table.status),
  ],
);

export const saleItems = pgTable("sale_items", {
  id: integer("id_sale_item").primaryKey().generatedByDefaultAsIdentity(),
  saleId: integer("id_sale")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  productId: integer("id_product")
    .notNull()
    .references(() => products.id),
  // Snapshots: historical sales must show the price actually charged,
  // not today's price, even after the product is edited or deactivated.
  productName: text("product_name").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
  // Worker discount applied to this line: soles per unit (snapshot of the
  // product setting) and the amount taken off lineTotal. discount_percent is
  // the legacy % from before discounts were in soles.
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  discountUnitAmount: numeric("discount_unit_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  // Given away whole: the birthday gift (one unit), or on older sales an
  // admin-approved courtesy.
  isGift: boolean("is_courtesy").notNull().default(false),
  // Snapshot of products.price_cost when sold, for the real margin.
  unitCost: numeric("unit_cost", { precision: 12, scale: 4 }),
  captureSource: captureSourceEnum("capture_source"),
});

// Physical places that hold stock (back room and shop floor today).
export const locations = pgTable("locations", {
  id: integer("id_location").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull().unique(),
  kind: locationKindEnum("kind").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Kardex: stock is never edited, every change is an append-only row. The
// unique key makes a retried sync (same sale, same product) a no-op.
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: integer("id_movement").primaryKey().generatedByDefaultAsIdentity(),
    productId: integer("id_product")
      .notNull()
      .references(() => products.id),
    locationId: integer("id_location")
      .notNull()
      .references(() => locations.id),
    qtyDelta: integer("qty_delta").notNull(),
    // Balance of this product at this location right after the movement,
    // in server (sync) order.
    balanceAfter: integer("balance_after").notNull(),
    type: stockMovementTypeEnum("type").notNull(),
    // Key of the document that caused the movement (the sale's uuid, a
    // count's…). Not a foreign key: it points at different tables.
    refId: uuid("ref_id").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 4 }),
    note: text("note"),
    actorId: integer("id_actor").references(() => users.id),
    // Device time (an offline sale moves stock when it was made).
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stock_movements_ref_unique").on(
      table.type,
      table.refId,
      table.productId,
      table.locationId,
    ),
    index("stock_movements_product_idx").on(table.productId, table.createdAt),
  ],
);

// Units of a product at a location that share an expiry date. stock_levels
// stays the total; units beyond the lots' sum are stock without a date.
// Counts set the lots, receipts add to them and sales consume them FEFO.
export const stockLots = pgTable(
  "stock_lots",
  {
    id: integer("id_lot").primaryKey().generatedByDefaultAsIdentity(),
    productId: integer("id_product")
      .notNull()
      .references(() => products.id),
    locationId: integer("id_location")
      .notNull()
      .references(() => locations.id),
    expiresAt: date("expires_at", { mode: "string" }).notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stock_lots_product_location_expiry_unique").on(
      table.productId,
      table.locationId,
      table.expiresAt,
    ),
    index("stock_lots_expires_idx").on(table.expiresAt),
  ],
);

// What was asked of a supplier before it arrives. Receipts made from it
// move its status (pending → partial → received).
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: integer("id_order").primaryKey().generatedByDefaultAsIdentity(),
    supplierId: integer("id_supplier")
      .notNull()
      .references(() => suppliers.id),
    status: purchaseOrderStatusEnum("status").notNull().default("pending"),
    expectedAt: date("expected_at", { mode: "string" }),
    // Sum of the lines' estimated cost (when known).
    estimatedTotal: numeric("estimated_total", { precision: 10, scale: 2 }),
    note: text("note"),
    createdBy: integer("id_created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("purchase_orders_status_idx").on(table.status)],
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: integer("id_order_item").primaryKey().generatedByDefaultAsIdentity(),
    orderId: integer("id_order")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    productId: integer("id_product")
      .notNull()
      .references(() => products.id),
    // null = ordered by the unit.
    presentationId: integer("id_presentation"),
    quantity: integer("quantity").notNull(),
    units: integer("units").notNull(),
    estimatedTotal: numeric("estimated_total", { precision: 10, scale: 2 }),
  },
  (table) => [
    // Named explicitly: the generated name exceeds Postgres' 63 chars.
    foreignKey({
      columns: [table.presentationId],
      foreignColumns: [productPresentations.id],
      name: "purchase_order_items_presentation_fk",
    }),
    index("purchase_order_items_order_idx").on(table.orderId),
  ],
);

// Merchandise entering a location (the Almacén) from a supplier. Each line
// moves stock_movements (purchase_receipt) and stock_lots in the same
// transaction, and updates the product's weighted average cost.
export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id: integer("id_receipt").primaryKey().generatedByDefaultAsIdentity(),
    // stock_movements.ref_id of the receipt's movements.
    uuid: uuid("uuid").notNull().unique().defaultRandom(),
    supplierId: integer("id_supplier").references(() => suppliers.id),
    // The purchase order this merchandise answers, if any.
    orderId: integer("id_order").references(() => purchaseOrders.id),
    locationId: integer("id_location")
      .notNull()
      .references(() => locations.id),
    docType: receiptDocTypeEnum("doc_type").notNull().default("ninguno"),
    // Serie-número as printed, e.g. "F020-00014194".
    docNumber: text("doc_number"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    note: text("note"),
    createdBy: integer("id_created_by").references(() => users.id),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // The same invoice can't be entered twice.
    uniqueIndex("goods_receipts_document_unique")
      .on(table.supplierId, table.docType, table.docNumber)
      .where(sql`${table.docNumber} is not null`),
    index("goods_receipts_received_idx").on(table.receivedAt),
  ],
);

export const goodsReceiptItems = pgTable(
  "goods_receipt_items",
  {
    id: integer("id_receipt_item").primaryKey().generatedByDefaultAsIdentity(),
    receiptId: integer("id_receipt")
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: "cascade" }),
    productId: integer("id_product")
      .notNull()
      .references(() => products.id),
    // null = bought by the unit.
    presentationId: integer("id_presentation"),
    // What the invoice says: in presentations (2 Cajas) and in units
    // (2 × 144 = 288). received_units is what actually arrived; stock moves
    // by it and any gap becomes a receipt_discrepancies row.
    quantity: integer("quantity").notNull(),
    units: integer("units").notNull(),
    receivedUnits: integer("received_units").notNull(),
    lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 4 }).notNull(),
    isBonus: boolean("is_bonus").notNull().default(false),
    expiresAt: date("expires_at", { mode: "string" }),
    captureSource: captureSourceEnum("capture_source"),
  },
  (table) => [
    // Named explicitly: the generated name exceeds Postgres' 63 chars.
    foreignKey({
      columns: [table.presentationId],
      foreignColumns: [productPresentations.id],
      name: "goods_receipt_items_presentation_fk",
    }),
    index("goods_receipt_items_receipt_idx").on(table.receiptId),
  ],
);

// A receipt line where what arrived didn't match the invoice. units < 0:
// missing; units > 0: extra. Stays "open" until the admin says what
// happened (see discrepancyStatusEnum).
export const receiptDiscrepancies = pgTable(
  "receipt_discrepancies",
  {
    id: integer("id_discrepancy").primaryKey().generatedByDefaultAsIdentity(),
    // stock_movements.ref_id when resolving moves stock.
    uuid: uuid("uuid").notNull().unique().defaultRandom(),
    receiptId: integer("id_receipt")
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: "cascade" }),
    receiptItemId: integer("id_receipt_item").notNull(),
    productId: integer("id_product")
      .notNull()
      .references(() => products.id),
    units: integer("units").notNull(),
    // |units| × the line's cost per unit.
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    status: discrepancyStatusEnum("status").notNull().default("open"),
    resolutionNote: text("resolution_note"),
    resolvedBy: integer("id_resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Named explicitly: the generated name exceeds Postgres' 63 chars.
    foreignKey({
      columns: [table.receiptItemId],
      foreignColumns: [goodsReceiptItems.id],
      name: "receipt_discrepancies_item_fk",
    }).onDelete("cascade"),
    index("receipt_discrepancies_status_idx").on(table.status),
  ],
);

// One "conteo del día" at a location: who counted what, and when.
export const stockCounts = pgTable("stock_counts", {
  id: integer("id_count").primaryKey().generatedByDefaultAsIdentity(),
  // stock_movements.ref_id of the adjustments it ends up causing.
  uuid: uuid("uuid").notNull().unique().defaultRandom(),
  locationId: integer("id_location")
    .notNull()
    .references(() => locations.id),
  countedBy: integer("id_counted_by").references(() => users.id),
  countedAt: timestamp("counted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stockCountItems = pgTable(
  "stock_count_items",
  {
    id: integer("id_count_item").primaryKey().generatedByDefaultAsIdentity(),
    countId: integer("id_count")
      .notNull()
      .references(() => stockCounts.id, { onDelete: "cascade" }),
    productId: integer("id_product")
      .notNull()
      .references(() => products.id),
    // System balance when it was counted (never shown to whoever counts).
    expected: integer("expected").notNull(),
    counted: integer("counted").notNull(),
    // Units by expiry date, for products that expire.
    lots: jsonb("lots")
      .$type<{ expiresAt: string; quantity: number }[]>()
      .notNull()
      .default([]),
    status: countItemStatusEnum("status").notNull(),
    reviewedBy: integer("id_reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    captureSource: captureSourceEnum("capture_source"),
  },
  (table) => [
    index("stock_count_items_status_idx").on(table.status),
    index("stock_count_items_product_idx").on(table.productId),
  ],
);

// Units moved between locations (Almacén → Tienda). Lots travel with them,
// soonest expiry first.
export const stockTransfers = pgTable("stock_transfers", {
  id: integer("id_transfer").primaryKey().generatedByDefaultAsIdentity(),
  uuid: uuid("uuid").notNull().unique().defaultRandom(),
  fromLocationId: integer("id_from_location")
    .notNull()
    .references(() => locations.id),
  toLocationId: integer("id_to_location")
    .notNull()
    .references(() => locations.id),
  note: text("note"),
  createdBy: integer("id_created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stockTransferItems = pgTable("stock_transfer_items", {
  id: integer("id_transfer_item").primaryKey().generatedByDefaultAsIdentity(),
  transferId: integer("id_transfer")
    .notNull()
    .references(() => stockTransfers.id, { onDelete: "cascade" }),
  productId: integer("id_product")
    .notNull()
    .references(() => products.id),
  units: integer("units").notNull(),
  captureSource: captureSourceEnum("capture_source"),
});

// Denormalized sum of stock_movements per product and location, updated in
// the same transaction with an atomic `quantity + delta`.
export const stockLevels = pgTable(
  "stock_levels",
  {
    productId: integer("id_product")
      .notNull()
      .references(() => products.id),
    locationId: integer("id_location")
      .notNull()
      .references(() => locations.id),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.productId, table.locationId] })],
);

// Points ledger: every movement is a row, so the balance can always be
// explained. id_sale is unique so a retried sync never awards points twice.
export const loyaltyLedger = pgTable(
  "loyalty_ledger",
  {
    id: integer("id_loyalty").primaryKey().generatedByDefaultAsIdentity(),
    workerId: integer("id_worker")
      .notNull()
      .references(() => workers.id),
    saleId: integer("id_sale")
      .unique()
      .references(() => sales.id),
    points: integer("points").notNull(),
    type: loyaltyMovementTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("loyalty_ledger_worker_idx").on(table.workerId)],
);

// Append-only trail of sensitive actions (registrations, approvals, policy
// changes, failed "Mis puntos" logins…). Some are created offline, hence client uuids and
// occurred_at (device time) next to created_at (server time).
export const auditEvents = pgTable(
  "audit_events",
  {
    id: integer("id_audit").primaryKey().generatedByDefaultAsIdentity(),
    // Client-generated for offline events: the sync's idempotency key.
    uuid: uuid("uuid").notNull().unique().defaultRandom(),
    type: text("type").notNull(),
    actorId: integer("id_actor").references(() => users.id),
    workerId: integer("id_worker").references(() => workers.id),
    // sales.uuid, not a foreign key: the event may happen at the till
    // before the sale exists on the server.
    saleUuid: uuid("sale_uuid"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_occurred_idx").on(table.occurredAt),
    index("audit_events_worker_type_idx").on(
      table.workerId,
      table.type,
      table.occurredAt,
    ),
  ],
);

// Two relations point from sales to users (cashier and courtesy approver),
// so both sides are named.
export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales, { relationName: "sale_cashier" }),
  approvedCourtesies: many(sales, { relationName: "sale_courtesy_approver" }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  saleItems: many(saleItems),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  cashier: one(users, {
    fields: [sales.cashierId],
    references: [users.id],
    relationName: "sale_cashier",
  }),
  courtesyApprover: one(users, {
    fields: [sales.courtesyApprovedBy],
    references: [users.id],
    relationName: "sale_courtesy_approver",
  }),
  worker: one(workers, {
    fields: [sales.workerId],
    references: [workers.id],
  }),
  items: many(saleItems),
}));

export const workersRelations = relations(workers, ({ one, many }) => ({
  registeredByUser: one(users, {
    fields: [workers.registeredBy],
    references: [users.id],
  }),
  sales: many(sales),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

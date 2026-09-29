import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const userRoleEnum = pgEnum("user_role", ["admin", "cashier"]);
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
export const workerVerificationEnum = pgEnum("worker_verification", [
  "none",
  "pin_online",
  "pin_offline",
]);
export const loyaltyMovementTypeEnum = pgEnum("loyalty_movement_type", [
  "earn",
  "adjust",
  "reverse",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Login identifier (e.g. "Ori2026") — not an email address.
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // Required by the Auth.js adapter's User model; nullable since login is
  // by username, not email. Ready for a future OAuth provider.
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

// Auth.js Drizzle adapter tables. Unused columns (accounts/verificationTokens)
// stay ready for a future OAuth provider without a schema migration.
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
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
  userId: uuid("user_id")
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
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Key from CATEGORY_ICONS (domain); the UI maps it to an icon component.
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
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
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").unique(),
    name: text("name").notNull(),
    description: text("description"),
    // No hard deletes: categories are deactivated, so sale history keeps
    // resolving product -> category.
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    priceSale: numeric("price_sale", { precision: 10, scale: 2 }).notNull(),
    // Discount airport workers get on this product (0–99). Giving a product
    // away (100%) is a courtesy approved by an admin at the till, not a
    // product setting.
    workerDiscountPercent: numeric("worker_discount_percent", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("0"),
    // Reserved for a future inventory phase — unused by phase-1 UI/actions.
    priceCost: numeric("price_cost", { precision: 10, scale: 2 }),
    stockQuantity: integer("stock_quantity"),
    trackStock: boolean("track_stock").notNull().default(false),
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

// Airport workers: customers entitled to the staff discount. Independent from
// `users` (the minimarket's own staff) — workers never log into the POS.
export const workers = pgTable(
  "workers",
  {
    // Client-generated UUID: a registration made offline supplies its own id.
    id: uuid("id").primaryKey().defaultRandom(),
    dni: text("dni").notNull().unique(),
    fullName: text("full_name").notNull(),
    nameSource: workerNameSourceEnum("name_source").notNull(),
    company: text("company").notNull(),
    // "pbkdf2-sha256$<iterations>$<salt>$<hash>" — see pin-hash.ts.
    pinHash: text("pin_hash").notNull(),
    pinUpdatedAt: timestamp("pin_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: workerStatusEnum("status").notNull().default("pending"),
    pendingReason: workerPendingReasonEnum("pending_reason").default("new"),
    // Denormalized sum of loyalty_ledger, updated in the same transaction.
    pointsBalance: integer("points_balance").notNull().default(0),
    registeredBy: uuid("registered_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
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
  id: uuid("id").primaryKey().defaultRandom(),
  discountPercent: numeric("discount_percent", {
    precision: 5,
    scale: 2,
  }).notNull(),
  maxDiscountedSalesPerDay: integer("max_discounted_sales_per_day").notNull(),
  maxDiscountPerMonth: numeric("max_discount_per_month", {
    precision: 10,
    scale: 2,
  }).notNull(),
  pointsPerSol: numeric("points_per_sol", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sales = pgTable(
  "sales",
  {
    // Client-generated UUID (offline-created sales supply their own id);
    // defaultRandom() is only a fallback for server-side inserts (e.g. seed).
    id: uuid("id").primaryKey().defaultRandom(),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => users.id),
    status: saleStatusEnum("status").notNull().default("completed"),
    paymentType: paymentTypeEnum("payment_type").notNull(),
    // subtotal - discount_total = total (what the customer actually paid).
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    discountTotal: numeric("discount_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    // Value of the lines given away as courtesy (part of subtotal, not of
    // total), and the admin who approved them at the till.
    courtesyTotal: numeric("courtesy_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    courtesyApprovedBy: uuid("courtesy_approved_by").references(() => users.id),
    workerId: uuid("worker_id").references(() => workers.id),
    policyId: uuid("policy_id").references(() => discountPolicies.id),
    workerVerification: workerVerificationEnum("worker_verification")
      .notNull()
      .default("none"),
    pointsEarned: integer("points_earned").notNull().default(0),
    // Anomalies found when the server re-priced the sale (see sale-audit.ts).
    auditFlags: text("audit_flags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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
  ],
);

export const saleItems = pgTable("sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  // Snapshots: historical sales must show the price actually charged,
  // not today's price, even after the product is edited or deactivated.
  productName: text("product_name").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
  // Worker discount applied to this line (snapshot of the product setting)
  // and the amount taken off lineTotal. A courtesy line is fully given away.
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  isCourtesy: boolean("is_courtesy").notNull().default(false),
});

// Points ledger: every movement is a row, so the balance can always be
// explained. sale_id is unique so a retried sync never awards points twice.
export const loyaltyLedger = pgTable(
  "loyalty_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id),
    saleId: uuid("sale_id")
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

// Append-only trail of sensitive actions (failed PINs, approvals, PIN
// resets, policy changes). Some are created offline, hence client ids and
// occurred_at (device time) next to created_at (server time).
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    workerId: uuid("worker_id").references(() => workers.id),
    saleId: uuid("sale_id"),
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

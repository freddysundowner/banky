import { sql } from "drizzle-orm";
import { pgTable, varchar, text, boolean, time, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

// Deployment mode
export const DeploymentMode = {
  SAAS: "saas",
  STANDALONE: "standalone",
} as const;

export type DeploymentModeType = typeof DeploymentMode[keyof typeof DeploymentMode];

// Organization table - core of the system (stored in master DB)
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic details
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).unique(),
  logo: text("logo"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  
  // Deployment mode
  deploymentMode: varchar("deployment_mode", { length: 20 }).default("saas").notNull(),
  
  // Tenant database connection (Neon)
  neonProjectId: varchar("neon_project_id", { length: 100 }),
  neonBranchId: varchar("neon_branch_id", { length: 100 }),
  connectionString: text("connection_string"),
  
  // Working hours
  workingHoursStart: time("working_hours_start").default("08:00:00"),
  workingHoursEnd: time("working_hours_end").default("17:00:00"),
  workingDays: jsonb("working_days").$type<string[]>().default(["monday", "tuesday", "wednesday", "thursday", "friday"]),
  
  // Financial settings
  currency: varchar("currency", { length: 10 }).default("KES").notNull(),
  financialYearStart: varchar("financial_year_start", { length: 5 }).default("01-01"),
  
  // Access control settings
  enforceWorkingHours: boolean("enforce_working_hours").default(false),
  autoLogoutMinutes: varchar("auto_logout_minutes", { length: 10 }).default("30"),
  requireTwoFactorAuth: boolean("require_two_factor_auth").default(false),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organization members table - links users to organizations
export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role", { length: 50 }).default("member").notNull(),
  isOwner: boolean("is_owner").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  neonProjectId: true,
  neonBranchId: true,
  connectionString: true,
  createdAt: true,
  updatedAt: true,
});

export const updateOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  neonProjectId: true,
  neonBranchId: true,
  connectionString: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({
  id: true,
  createdAt: true,
});

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;

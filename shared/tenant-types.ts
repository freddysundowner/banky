import { z } from "zod";

// Branch types
export const branchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Branch name is required"),
  code: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.date().optional(),
});

export const insertBranchSchema = branchSchema.omit({ id: true, created_at: true });
export const updateBranchSchema = insertBranchSchema.partial();

export type Branch = z.infer<typeof branchSchema>;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type UpdateBranch = z.infer<typeof updateBranchSchema>;

// Staff types
export const staffRoles = ["admin", "manager", "loan_officer", "teller", "accountant", "staff"] as const;
export type StaffRole = typeof staffRoles[number];

export const staffSchema = z.object({
  id: z.string().uuid(),
  staff_number: z.string().optional().nullable(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  secondary_email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.enum(staffRoles).default("staff"),
  branch_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.date().optional(),
});

export const insertStaffSchema = staffSchema.omit({ id: true, created_at: true });
export const updateStaffSchema = insertStaffSchema.partial();

export type Staff = z.infer<typeof staffSchema>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type UpdateStaff = z.infer<typeof updateStaffSchema>;

// Member types
export const memberSchema = z.object({
  id: z.string().uuid(),
  member_number: z.string().min(1, "Member number is required"),
  
  // Personal Information
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string().optional().nullable(),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(1, "Phone is required"),
  phone_secondary: z.string().optional().nullable(),
  id_type: z.string().optional().nullable(),
  id_number: z.string().optional().nullable(),
  kra_pin: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  marital_status: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  
  // Address Information
  address: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  county: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  
  // Next of Kin 1
  next_of_kin_name: z.string().optional().nullable(),
  next_of_kin_phone: z.string().optional().nullable(),
  next_of_kin_relationship: z.string().optional().nullable(),
  next_of_kin_id_number: z.string().optional().nullable(),
  next_of_kin_address: z.string().optional().nullable(),
  
  // Next of Kin 2
  next_of_kin_2_name: z.string().optional().nullable(),
  next_of_kin_2_phone: z.string().optional().nullable(),
  next_of_kin_2_relationship: z.string().optional().nullable(),
  
  // Employment Information
  employment_status: z.string().optional().nullable(),
  employer_name: z.string().optional().nullable(),
  employer_address: z.string().optional().nullable(),
  employer_phone: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  monthly_income: z.string().optional().nullable(),
  employment_date: z.string().optional().nullable(),
  
  // Bank Details
  bank_name: z.string().optional().nullable(),
  bank_branch: z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  bank_account_name: z.string().optional().nullable(),
  
  // Membership Details
  branch_id: z.string().uuid().optional().nullable(),
  membership_type: z.string().optional().nullable(),
  registration_fee_paid: z.string().optional().nullable(),
  share_capital: z.string().optional().nullable(),
  
  // Account Balances
  savings_balance: z.string().default("0"),
  shares_balance: z.string().default("0"),
  deposits_balance: z.string().default("0"),
  
  // Pending Balances (cheques in clearing)
  savings_pending: z.string().default("0"),
  shares_pending: z.string().default("0"),
  deposits_pending: z.string().default("0"),
  
  // Status and Dates
  status: z.string().default("active"),
  is_active: z.boolean().default(true),
  joined_at: z.string().optional().nullable(),
  created_at: z.date().optional(),
  created_by_id: z.string().optional().nullable(),
  
  // Documents
  photo_url: z.string().optional().nullable(),
  id_document_url: z.string().optional().nullable(),
  signature_url: z.string().optional().nullable(),
});

export const insertMemberSchema = memberSchema.omit({ id: true, created_at: true, member_number: true });
export const updateMemberSchema = insertMemberSchema.partial();

export type Member = z.infer<typeof memberSchema>;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type UpdateMember = z.infer<typeof updateMemberSchema>;

// Loan product types
export const interestTypes = ["flat", "reducing_balance"] as const;

export const loanProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Product name is required"),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  interest_rate: z.string(),
  interest_type: z.enum(interestTypes).default("reducing_balance"),
  min_amount: z.string(),
  max_amount: z.string(),
  min_term_months: z.number().int().positive(),
  max_term_months: z.number().int().positive(),
  processing_fee: z.string().optional().default("0"),
  insurance_fee: z.string().optional().default("0"),
  late_payment_penalty: z.string().optional().default("0"),
  grace_period_days: z.number().optional().default(0),
  requires_guarantor: z.boolean().default(false),
  min_guarantors: z.number().optional().default(0),
  max_guarantors: z.number().optional().default(3),
  shares_multiplier: z.string().optional().default("3"),
  min_shares_required: z.string().optional().default("0"),
  deduct_interest_upfront: z.boolean().default(false),
  is_active: z.boolean().default(true),
  created_at: z.date().optional(),
});

export const insertLoanProductSchema = loanProductSchema.omit({ id: true, created_at: true });
export const updateLoanProductSchema = insertLoanProductSchema.partial();

export type LoanProduct = z.infer<typeof loanProductSchema>;
export type InsertLoanProduct = z.infer<typeof insertLoanProductSchema>;
export type UpdateLoanProduct = z.infer<typeof updateLoanProductSchema>;

// Loan application types
export const loanStatuses = ["pending", "under_review", "approved", "rejected", "disbursed", "completed", "defaulted"] as const;
export type LoanStatus = typeof loanStatuses[number];

export const loanApplicationSchema = z.object({
  id: z.string().uuid(),
  application_number: z.string(),
  member_id: z.string().uuid(),
  product_id: z.string().uuid(),
  amount: z.string(),
  term: z.number().int().positive(),
  purpose: z.string().optional().nullable(),
  status: z.enum(loanStatuses).default("pending"),
  guarantor_id: z.string().uuid().optional().nullable(),
  monthly_payment: z.string().optional().nullable(),
  total_amount: z.string().optional().nullable(),
  total_interest: z.string().optional().nullable(),
  rejection_reason: z.string().optional().nullable(),
  approved_by: z.string().uuid().optional().nullable(),
  approved_at: z.date().optional().nullable(),
  disbursed_at: z.date().optional().nullable(),
  interest_deducted_upfront: z.boolean().default(false),
  created_at: z.date().optional(),
});

export const insertLoanApplicationSchema = loanApplicationSchema.omit({
  id: true,
  application_number: true,
  monthly_payment: true,
  total_amount: true,
  total_interest: true,
  rejection_reason: true,
  approved_by: true,
  approved_at: true,
  disbursed_at: true,
  created_at: true,
});

export const updateLoanApplicationSchema = loanApplicationSchema.partial();

export type LoanApplication = z.infer<typeof loanApplicationSchema>;
export type InsertLoanApplication = z.infer<typeof insertLoanApplicationSchema>;
export type UpdateLoanApplication = z.infer<typeof updateLoanApplicationSchema>;

// Transaction types
export const transactionTypes = ["deposit", "withdrawal", "loan_disbursement", "loan_repayment", "share_purchase", "fee", "interest"] as const;

export const transactionSchema = z.object({
  id: z.string().uuid(),
  member_id: z.string().uuid(),
  type: z.enum(transactionTypes),
  amount: z.string(),
  balance_after: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  created_by: z.string().uuid().optional().nullable(),
  created_at: z.date().optional(),
});

export const insertTransactionSchema = transactionSchema.omit({ id: true, created_at: true });

export type Transaction = z.infer<typeof transactionSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

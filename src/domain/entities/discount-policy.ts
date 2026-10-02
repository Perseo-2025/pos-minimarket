// Versioned: a policy is never edited in place. Changing the discount inserts
// a new version, so every sale keeps pointing at the exact rule it was
// charged under and the audit trail shows who changed what and when.
//
// The discount itself (soles off per unit) lives on each product; the policy
// holds the limits around it.
export interface DiscountPolicy {
  id: number;
  // Units per purchase that get the product's discount (the first N in the
  // basket); the rest are charged at full price.
  maxDiscountedUnitsPerSale: number;
  maxDiscountedSalesPerDay: number;
  pointsPerSol: number;
  // Highest price a birthday gift may have (0 = no birthday gift).
  birthdayGiftMaxAmount: number;
  isActive: boolean;
  createdById: number | null;
  createdByName?: string | null;
  createdAt: Date;
}

export interface DiscountPolicyData {
  maxDiscountedUnitsPerSale: number;
  maxDiscountedSalesPerDay: number;
  pointsPerSol: number;
  birthdayGiftMaxAmount: number;
}

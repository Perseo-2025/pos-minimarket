// Versioned: a policy is never edited in place. Changing the discount inserts
// a new version, so every sale keeps pointing at the exact rule it was
// charged under and the audit trail shows who changed what and when.
export interface DiscountPolicy {
  id: string;
  discountPercent: number;
  maxDiscountedSalesPerDay: number;
  maxDiscountPerMonth: number;
  pointsPerSol: number;
  isActive: boolean;
  createdById: string | null;
  createdByName?: string | null;
  createdAt: Date;
}

export interface DiscountPolicyData {
  discountPercent: number;
  maxDiscountedSalesPerDay: number;
  maxDiscountPerMonth: number;
  pointsPerSol: number;
}

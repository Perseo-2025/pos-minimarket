import type {
  DiscountPolicy,
  DiscountPolicyData,
} from "../entities/discount-policy";

export interface DiscountPolicyRepository {
  getActive(): Promise<DiscountPolicy | null>;
  findById(id: string): Promise<DiscountPolicy | null>;
  listVersions(limit: number): Promise<DiscountPolicy[]>;
  // Deactivates the current version and inserts the new one atomically.
  createVersion(data: DiscountPolicyData, actorId: string): Promise<DiscountPolicy>;
}

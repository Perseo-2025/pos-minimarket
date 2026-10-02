import { can } from "@/domain/entities/user";
import { InvalidAdminCredentialsError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import { lineTotal } from "@/domain/services/sale-pricing";
import { round2 } from "@/domain/value-objects/money";
import { courtesyApprovalSchema } from "@/application/validation/sale";
import { authenticateUserUseCase } from "../auth/authenticate-user";

export interface ApproveCourtesyDeps {
  users: UserRepository;
  audit: AuditRepository;
  issueCourtesyToken: (input: {
    saleUuid: string;
    cashierId: number;
    adminId: number;
    amount: number;
  }) => string;
}

// An admin approves, at the cashier's till, giving products away. Every
// attempt is audited — a run of wrong passwords at one till is exactly the
// pattern the owner wants to see.
export async function approveCourtesyUseCase(
  deps: ApproveCourtesyDeps,
  input: unknown,
  cashierId: number,
) {
  const data = courtesyApprovalSchema.parse(input);
  const amount = round2(data.items.reduce((sum, item) => sum + lineTotal(item), 0));
  const items = data.items.map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
  }));

  const admin = await authenticateUserUseCase(deps.users, {
    username: data.username,
    password: data.password,
  });

  if (!admin || !can(admin.role, "manage")) {
    await deps.audit.record({
      type: "courtesy_denied",
      actorId: cashierId,
      saleUuid: data.saleUuid,
      payload: { username: data.username, amount, items },
      occurredAt: new Date(),
    });
    throw new InvalidAdminCredentialsError();
  }

  await deps.audit.record({
    type: "courtesy_approved",
    actorId: admin.id,
    saleUuid: data.saleUuid,
    payload: { cashierId, amount, items },
    occurredAt: new Date(),
  });

  return {
    token: deps.issueCourtesyToken({
      saleUuid: data.saleUuid,
      cashierId,
      adminId: admin.id,
      amount,
    }),
    amount,
    adminName: admin.name,
  };
}

import { DNI_LOOKUP_TIMEOUT_MS, identityLookup } from "./identity";
import type { AttendanceDeps } from "@/application/use-cases/attendance/deps";
import {
  attendanceRepository,
  auditRepository,
  cashShiftRepository,
  discountPolicyRepository,
  productRepository,
  saleRepository,
  userRepository,
  workerRepository,
  workScheduleRepository,
} from "./repositories";

// Composition root for the use cases that need several adapters.
export const saleDeps = {
  sales: saleRepository,
  users: userRepository,
  products: productRepository,
  workers: workerRepository,
  policies: discountPolicyRepository,
};

export const workerDeps = {
  workers: workerRepository,
  audit: auditRepository,
  identity: identityLookup,
  policies: discountPolicyRepository,
};

export const attendanceDeps: AttendanceDeps = {
  attendance: attendanceRepository,
  schedules: workScheduleRepository,
  audit: auditRepository,
  shifts: cashShiftRepository,
};

export { DNI_LOOKUP_TIMEOUT_MS };

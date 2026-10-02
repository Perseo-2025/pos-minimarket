"use server";

import { revalidatePath } from "next/cache";
import {
  addAttendanceUseCase,
  adminCorrectUseCase,
  reviewCorrectionUseCase,
} from "@/application/use-cases/attendance/corrections";
import { saveScheduleUseCase } from "@/application/use-cases/attendance/schedules";
import { requirePermission } from "@/infrastructure/auth/guards";
import { attendanceDeps } from "@/infrastructure/deps";
import { runAction } from "./action-result";

export async function saveSchedule(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await saveScheduleUseCase(attendanceDeps, input, admin);
    revalidatePath("/admin/asistencia", "layout");
  });
}

export async function reviewCorrection(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await reviewCorrectionUseCase(attendanceDeps, input, admin);
    revalidatePath("/admin", "layout");
  });
}

export async function correctAttendance(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await adminCorrectUseCase(attendanceDeps, input, admin);
    revalidatePath("/admin", "layout");
  });
}

export async function addAttendance(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await addAttendanceUseCase(attendanceDeps, input, admin);
    revalidatePath("/admin", "layout");
  });
}

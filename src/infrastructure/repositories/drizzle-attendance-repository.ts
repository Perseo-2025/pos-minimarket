import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  AttendanceCorrection,
  AttendanceCorrectionStatus,
  AttendanceRecordDetail,
} from "@/domain/entities/attendance";
import type {
  AttendanceRepository,
  NewAttendanceCorrection,
  NewAttendanceRecord,
} from "@/domain/repositories/attendance-repository";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { db } from "@/infrastructure/db/client";
import {
  attendanceCorrections,
  attendanceRecords,
  users,
} from "@/infrastructure/db/schema";

const person = alias(users, "person");
const creator = alias(users, "creator");
const requester = alias(users, "requester");
const reviewer = alias(users, "reviewer");

function selectRecords() {
  return db
    .select({ record: attendanceRecords, userName: person.name, createdByName: creator.name })
    .from(attendanceRecords)
    .innerJoin(person, eq(person.id, attendanceRecords.userId))
    .leftJoin(creator, eq(creator.id, attendanceRecords.createdBy));
}

type RecordRow = Awaited<ReturnType<typeof selectRecords>>[number];

function toDetail({ record, userName, createdByName }: RecordRow): AttendanceRecordDetail {
  return {
    id: record.id,
    uuid: record.uuid,
    userId: record.userId,
    userName,
    workDate: record.workDate,
    clockInAt: record.clockInAt,
    clockOutAt: record.clockOutAt,
    scheduledStart: record.scheduledStart,
    scheduledEnd: record.scheduledEnd,
    toleranceMin: record.toleranceMin,
    lateMinutes: record.lateMinutes,
    earlyLeaveMinutes: record.earlyLeaveMinutes,
    status: record.status,
    offline: record.offline,
    timeSuspicious: record.timeSuspicious,
    isCorrected: record.isCorrected,
    createdByName,
    clockInDeviceAt: record.clockInDeviceAt,
    clockInReceivedAt: record.clockInReceivedAt,
    clockOutDeviceAt: record.clockOutDeviceAt,
    clockOutReceivedAt: record.clockOutReceivedAt,
    createdAt: record.createdAt,
  };
}

function selectCorrections() {
  return db
    .select({
      correction: attendanceCorrections,
      attendanceId: attendanceRecords.id,
      workDate: attendanceRecords.workDate,
      userName: person.name,
      requestedByName: requester.name,
      reviewedByName: reviewer.name,
    })
    .from(attendanceCorrections)
    .innerJoin(requester, eq(requester.id, attendanceCorrections.requestedBy))
    .leftJoin(reviewer, eq(reviewer.id, attendanceCorrections.reviewedBy))
    .leftJoin(attendanceRecords, eq(attendanceRecords.uuid, attendanceCorrections.attendanceUuid))
    .leftJoin(person, eq(person.id, attendanceRecords.userId));
}

type CorrectionRow = Awaited<ReturnType<typeof selectCorrections>>[number];

function toCorrection(row: CorrectionRow): AttendanceCorrection {
  const { correction } = row;
  return {
    id: correction.id,
    uuid: correction.uuid,
    attendanceUuid: correction.attendanceUuid,
    attendanceId: row.attendanceId,
    userName: row.userName,
    workDate: row.workDate,
    field: correction.field,
    oldValue: correction.oldValue,
    newValue: correction.newValue,
    reason: correction.reason,
    requestedById: correction.requestedBy,
    requestedByName: row.requestedByName,
    status: correction.status,
    reviewedByName: row.reviewedByName,
    reviewedAt: correction.reviewedAt,
    reviewNote: correction.reviewNote,
    createdAt: correction.createdAt,
  };
}

export class DrizzleAttendanceRepository implements AttendanceRepository {
  async insert(data: NewAttendanceRecord) {
    const inserted = await db
      .insert(attendanceRecords)
      .values({
        ...data,
        status: data.clockOutAt ? "closed" : "open",
        clockOutReceivedAt: data.clockOutAt ? data.clockInReceivedAt : null,
      })
      .onConflictDoNothing({ target: attendanceRecords.uuid })
      .returning({ id: attendanceRecords.id });
    return inserted.length > 0;
  }

  async findByUuid(uuid: string) {
    const [row] = await selectRecords().where(eq(attendanceRecords.uuid, uuid)).limit(1);
    return row ? toDetail(row) : null;
  }

  async findById(id: number) {
    const [row] = await selectRecords().where(eq(attendanceRecords.id, id)).limit(1);
    return row ? toDetail(row) : null;
  }

  async markForgotten(userId: number, exceptUuid: string) {
    await db
      .update(attendanceRecords)
      .set({ status: "missing_clock_out" })
      .where(
        and(
          eq(attendanceRecords.userId, userId),
          eq(attendanceRecords.status, "open"),
          ne(attendanceRecords.uuid, exceptUuid),
        ),
      );
  }

  async clockOut(data: {
    uuid: string;
    clockOutAt: Date;
    deviceAt: Date | null;
    receivedAt: Date;
    earlyLeaveMinutes: number;
    offline: boolean;
    timeSuspicious: boolean;
  }) {
    const updated = await db
      .update(attendanceRecords)
      .set({
        clockOutAt: data.clockOutAt,
        clockOutDeviceAt: data.deviceAt,
        clockOutReceivedAt: data.receivedAt,
        earlyLeaveMinutes: data.earlyLeaveMinutes,
        status: "closed",
        // Either mark made offline / with a doubtful clock taints the day.
        offline: sql`${attendanceRecords.offline} or ${data.offline}::boolean`,
        timeSuspicious: sql`${attendanceRecords.timeSuspicious} or ${data.timeSuspicious}::boolean`,
      })
      .where(and(eq(attendanceRecords.uuid, data.uuid), isNull(attendanceRecords.clockOutAt)))
      .returning({ id: attendanceRecords.id });
    return updated.length > 0;
  }

  async applyCorrection(data: {
    uuid: string;
    clockInAt: Date;
    clockOutAt: Date | null;
    workDate: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
  }) {
    await db
      .update(attendanceRecords)
      .set({
        clockInAt: data.clockInAt,
        clockOutAt: data.clockOutAt,
        workDate: data.workDate,
        lateMinutes: data.lateMinutes,
        earlyLeaveMinutes: data.earlyLeaveMinutes,
        isCorrected: true,
        // Fixing the exit closes the workday; an open one stays as it was.
        ...(data.clockOutAt ? { status: "closed" as const } : {}),
      })
      .where(eq(attendanceRecords.uuid, data.uuid));
  }

  async listOpen(userId: number) {
    const rows = await selectRecords()
      .where(
        and(
          eq(attendanceRecords.userId, userId),
          isNull(attendanceRecords.clockOutAt),
        ),
      )
      .orderBy(asc(attendanceRecords.clockInAt));
    return rows.map(toDetail);
  }

  async listByDates(from: string, to: string, userId?: number) {
    const rows = await selectRecords()
      .where(
        and(
          gte(attendanceRecords.workDate, from),
          lte(attendanceRecords.workDate, to),
          userId === undefined ? undefined : eq(attendanceRecords.userId, userId),
        ),
      )
      .orderBy(asc(attendanceRecords.clockInAt));
    return rows.map(toDetail);
  }

  async listPeople() {
    const marked = db
      .selectDistinct({ id: attendanceRecords.userId })
      .from(attendanceRecords);
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(or(inArray(users.role, ["cashier", "warehouse"]), inArray(users.id, marked)))
      .orderBy(asc(users.name));
    return rows.map(({ createdAt, ...row }) => ({ ...row, since: storeDateKey(createdAt) }));
  }

  async insertCorrection(data: NewAttendanceCorrection) {
    const { approvedBy, ...values } = data;
    const inserted = await db
      .insert(attendanceCorrections)
      .values({
        ...values,
        ...(approvedBy
          ? { status: "approved" as const, reviewedBy: approvedBy, reviewedAt: new Date() }
          : {}),
      })
      .onConflictDoNothing({ target: attendanceCorrections.uuid })
      .returning({ id: attendanceCorrections.id });
    return inserted.length > 0;
  }

  async findCorrection(id: number) {
    const [row] = await selectCorrections().where(eq(attendanceCorrections.id, id)).limit(1);
    return row ? toCorrection(row) : null;
  }

  async findCorrectionByUuid(uuid: string) {
    const [row] = await selectCorrections().where(eq(attendanceCorrections.uuid, uuid)).limit(1);
    return row ? toCorrection(row) : null;
  }

  async listCorrections(filter: {
    status?: AttendanceCorrectionStatus;
    attendanceUuid?: string;
    limit: number;
  }) {
    const rows = await selectCorrections()
      .where(
        and(
          filter.status ? eq(attendanceCorrections.status, filter.status) : undefined,
          filter.attendanceUuid
            ? eq(attendanceCorrections.attendanceUuid, filter.attendanceUuid)
            : undefined,
        ),
      )
      .orderBy(desc(attendanceCorrections.createdAt))
      .limit(filter.limit);
    return rows.map(toCorrection);
  }

  async countPendingCorrections() {
    const [row] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(attendanceCorrections)
      .where(eq(attendanceCorrections.status, "pending"));
    return row?.count ?? 0;
  }

  async reviewCorrection(data: {
    id: number;
    status: "approved" | "rejected";
    reviewerId: number;
    note: string | null;
  }) {
    const updated = await db
      .update(attendanceCorrections)
      .set({
        status: data.status,
        reviewedBy: data.reviewerId,
        reviewedAt: new Date(),
        reviewNote: data.note,
      })
      .where(
        and(eq(attendanceCorrections.id, data.id), eq(attendanceCorrections.status, "pending")),
      )
      .returning({ id: attendanceCorrections.id });
    return updated.length > 0;
  }
}

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type {
  AttendanceCorrection,
  AttendanceRecordDetail,
  WorkSchedule,
} from "@/domain/entities/attendance";
import type { AuditEventInput } from "@/domain/entities/audit";
import { ValidationError } from "@/domain/errors";
import type {
  AttendanceRepository,
  NewAttendanceCorrection,
  NewAttendanceRecord,
} from "@/domain/repositories/attendance-repository";
import { clockInUseCase, clockOutUseCase } from "./clock";
import { requestCorrectionUseCase, reviewCorrectionUseCase } from "./corrections";
import type { AttendanceDeps } from "./deps";

const lima = (dateKey: string, hhmm: string) => new Date(`${dateKey}T${hhmm}:00-05:00`);
const MONDAY = "2026-10-05";

const juan = { id: 7, role: "cashier" as const };
const admin = { id: 1, role: "admin" as const };

// Minimal in-memory adapter: only what the use cases call.
function fakeAttendance() {
  const records: AttendanceRecordDetail[] = [];
  const corrections: AttendanceCorrection[] = [];
  const repo: Partial<AttendanceRepository> = {
    async insert(data: NewAttendanceRecord) {
      if (records.some((r) => r.uuid === data.uuid)) return false;
      records.push({
        id: records.length + 1,
        userName: "Juan",
        clockOutAt: null,
        earlyLeaveMinutes: 0,
        status: "open",
        isCorrected: false,
        createdByName: null,
        clockOutDeviceAt: null,
        clockOutReceivedAt: null,
        createdAt: data.clockInReceivedAt,
        ...data,
      } as AttendanceRecordDetail);
      return true;
    },
    async findByUuid(uuid) {
      return records.find((r) => r.uuid === uuid) ?? null;
    },
    async markForgotten(userId, exceptUuid) {
      for (const r of records) {
        if (r.userId === userId && r.status === "open" && r.uuid !== exceptUuid) {
          r.status = "missing_clock_out";
        }
      }
    },
    async clockOut(data) {
      const r = records.find((x) => x.uuid === data.uuid);
      if (!r || r.clockOutAt) return false;
      Object.assign(r, {
        clockOutAt: data.clockOutAt,
        earlyLeaveMinutes: data.earlyLeaveMinutes,
        status: "closed",
      });
      return true;
    },
    async applyCorrection(data) {
      const r = records.find((x) => x.uuid === data.uuid)!;
      Object.assign(r, data, { isCorrected: true, status: data.clockOutAt ? "closed" : r.status });
    },
    async findCorrectionByUuid(uuid) {
      return corrections.find((c) => c.uuid === uuid) ?? null;
    },
    async findCorrection(id) {
      return corrections.find((c) => c.id === id) ?? null;
    },
    async insertCorrection(data: NewAttendanceCorrection) {
      corrections.push({
        id: corrections.length + 1,
        attendanceId: null,
        userName: null,
        workDate: null,
        requestedById: data.requestedBy,
        requestedByName: "",
        status: "pending",
        reviewedByName: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: new Date(),
        ...data,
      });
      return true;
    },
    async reviewCorrection(data) {
      const c = corrections.find((x) => x.id === data.id);
      if (!c || c.status !== "pending") return false;
      c.status = data.status;
      return true;
    },
  };
  return { records, corrections, repo: repo as AttendanceRepository };
}

const schedule: WorkSchedule[] = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  userId: juan.id,
  weekday,
  startTime: "07:00",
  endTime: "15:00",
  toleranceMin: 10,
}));

let store: ReturnType<typeof fakeAttendance>;
let audit: AuditEventInput[];
let openTill: boolean;
let now: Date;
let deps: AttendanceDeps;

beforeEach(() => {
  store = fakeAttendance();
  audit = [];
  openTill = false;
  now = lima(MONDAY, "07:25");
  deps = {
    attendance: store.repo,
    schedules: {
      listByUser: async () => schedule,
      listAll: async () => schedule,
      replaceForUser: async () => {},
    },
    audit: {
      record: async (event) => void audit.push(event),
      recordWithUuid: async (_uuid, event) => void audit.push(event),
    },
    shifts: { hasOpenShift: async () => openTill },
    now: () => now,
  };
});

const punch = (uuid: string, at: Date, live = true) => ({
  uuid,
  deviceAt: at.toISOString(),
  sentAt: at.toISOString(),
  live,
  clockMovedBack: false,
});

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

describe("clockInUseCase", () => {
  it("records lateness against the schedule and audits it", async () => {
    await clockInUseCase(deps, punch(UUID_A, now), juan);
    assert.equal(store.records.length, 1);
    assert.equal(store.records[0].lateMinutes, 25);
    assert.equal(store.records[0].workDate, MONDAY);
    assert.equal(audit[0].type, "attendance_clock_in");
  });

  it("a retried sync does not duplicate", async () => {
    await clockInUseCase(deps, punch(UUID_A, now), juan);
    await clockInUseCase(deps, punch(UUID_A, now), juan);
    assert.equal(store.records.length, 1);
    assert.equal(audit.length, 1);
  });

  it("a workday left open becomes 'forgot to mark the exit'", async () => {
    await clockInUseCase(deps, punch(UUID_A, now), juan);
    now = lima("2026-10-06", "07:00");
    await clockInUseCase(deps, punch(UUID_B, now), juan);
    assert.equal(store.records[0].status, "missing_clock_out");
    assert.equal(store.records[1].status, "open");
  });
});

describe("clockOutUseCase", () => {
  it("closes the workday with the early leave", async () => {
    await clockInUseCase(deps, punch(UUID_A, now), juan);
    now = lima(MONDAY, "14:30");
    await clockOutUseCase(deps, punch(UUID_A, now), juan);
    assert.equal(store.records[0].status, "closed");
    assert.equal(store.records[0].earlyLeaveMinutes, 30);
  });

  it("with the till still open it's accepted but audited", async () => {
    await clockInUseCase(deps, punch(UUID_A, now), juan);
    openTill = true;
    now = lima(MONDAY, "15:00");
    await clockOutUseCase(deps, punch(UUID_A, now), juan);
    assert.equal(store.records[0].status, "closed");
    assert.ok(audit.some((e) => e.type === "clock_out_with_open_till"));
  });

  it("nobody marks the exit of someone else", async () => {
    await clockInUseCase(deps, punch(UUID_A, now), juan);
    await assert.rejects(
      clockOutUseCase(deps, punch(UUID_A, now), { id: 99, role: "cashier" }),
      ValidationError,
    );
  });
});

describe("corrections", () => {
  beforeEach(async () => {
    await clockInUseCase(deps, punch(UUID_A, lima(MONDAY, "07:00")), juan);
    now = lima("2026-10-06", "07:00");
  });

  const request = {
    uuid: UUID_C,
    attendanceUuid: UUID_A,
    field: "clock_out" as const,
    newValue: "2026-10-05T15:00:00-05:00",
    reason: "Se me olvidó marcar la salida",
  };

  it("the person asks, an admin approves, the workday is fixed", async () => {
    await requestCorrectionUseCase(deps, request, juan);
    assert.equal(store.corrections[0].status, "pending");
    await reviewCorrectionUseCase(deps, { id: 1, approve: true, note: "" }, admin);
    assert.equal(store.corrections[0].status, "approved");
    assert.equal(store.records[0].status, "closed");
    assert.equal(store.records[0].isCorrected, true);
    assert.ok(audit.some((e) => e.type === "attendance_correction_approved"));
  });

  it("the exit can't be before the entrance or in the future", async () => {
    await assert.rejects(
      requestCorrectionUseCase(deps, { ...request, newValue: "2026-10-05T06:00:00-05:00" }, juan),
      ValidationError,
    );
    await assert.rejects(
      requestCorrectionUseCase(deps, { ...request, newValue: "2026-10-06T09:00:00-05:00" }, juan),
      ValidationError,
    );
  });

  it("nobody approves a correction of their own marks", async () => {
    await requestCorrectionUseCase(deps, request, juan);
    await assert.rejects(
      reviewCorrectionUseCase(deps, { id: 1, approve: true, note: "" }, { id: juan.id, role: "admin" }),
      ValidationError,
    );
  });

  it("a reviewed request can't be reviewed again", async () => {
    await requestCorrectionUseCase(deps, request, juan);
    await reviewCorrectionUseCase(deps, { id: 1, approve: false, note: "No coincide" }, admin);
    await assert.rejects(
      reviewCorrectionUseCase(deps, { id: 1, approve: true, note: "" }, admin),
      ValidationError,
    );
    assert.equal(store.records[0].isCorrected, false);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkSchedule } from "../entities/attendance";
import {
  buildPersonDay,
  computeEarlyLeave,
  computeLateMinutes,
  dateKeysBetween,
  formatMinutes,
  isOffSchedule,
  monthGrid,
  monthRange,
  resolvePunchTime,
  scheduleFor,
  summarizeDays,
  type DayRecordInput,
} from "./attendance";

// Lima is UTC-5: 07:00 in the store is 12:00Z.
const lima = (dateKey: string, hhmm: string) => new Date(`${dateKey}T${hhmm}:00-05:00`);

// Juan: Monday to Saturday 07:00–15:00, 10 minutes of tolerance.
const juan: WorkSchedule[] = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  userId: 1,
  weekday,
  startTime: "07:00",
  endTime: "15:00",
  toleranceMin: 10,
}));

// 2026-10-05 is a Monday, 2026-10-04 a Sunday.
const MONDAY = "2026-10-05";
const SUNDAY = "2026-10-04";

function record(overrides: Partial<DayRecordInput> = {}): DayRecordInput {
  return {
    workDate: MONDAY,
    clockInAt: lima(MONDAY, "07:04"),
    clockOutAt: lima(MONDAY, "15:02"),
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: "closed",
    isCorrected: false,
    offline: false,
    timeSuspicious: false,
    ...overrides,
  };
}

describe("scheduleFor", () => {
  it("returns the shift in store time, or null on a day off", () => {
    const shift = scheduleFor(MONDAY, juan)!;
    assert.equal(shift.start.toISOString(), "2026-10-05T12:00:00.000Z");
    assert.equal(shift.end.toISOString(), "2026-10-05T20:00:00.000Z");
    assert.equal(scheduleFor(SUNDAY, juan), null);
  });

  it("a night shift ends the next day", () => {
    const night = scheduleFor(MONDAY, [
      { weekday: 1, startTime: "22:00", endTime: "06:00", toleranceMin: 5 },
    ])!;
    assert.equal(night.end.toISOString(), "2026-10-06T11:00:00.000Z");
  });
});

describe("computeLateMinutes", () => {
  const shift = scheduleFor(MONDAY, juan);

  it("within the tolerance is on time", () => {
    assert.equal(computeLateMinutes(lima(MONDAY, "07:04"), shift), 0);
    assert.equal(computeLateMinutes(lima(MONDAY, "07:10"), shift), 0);
  });

  it("past the tolerance counts from the start", () => {
    assert.equal(computeLateMinutes(lima(MONDAY, "07:11"), shift), 11);
    assert.equal(computeLateMinutes(lima(MONDAY, "07:25"), shift), 25);
  });

  it("no schedule, no lateness", () => {
    assert.equal(computeLateMinutes(lima(SUNDAY, "09:00"), null), 0);
  });
});

describe("computeEarlyLeave", () => {
  it("minutes before the end of the shift", () => {
    const shift = scheduleFor(MONDAY, juan);
    assert.equal(computeEarlyLeave(lima(MONDAY, "14:30"), shift), 30);
    assert.equal(computeEarlyLeave(lima(MONDAY, "15:05"), shift), 0);
  });
});

describe("isOffSchedule", () => {
  const shift = scheduleFor(MONDAY, juan);

  it("allows 30 minutes around the shift", () => {
    assert.equal(isOffSchedule(lima(MONDAY, "06:35"), shift), false);
    assert.equal(isOffSchedule(lima(MONDAY, "06:20"), shift), true);
    assert.equal(isOffSchedule(lima(MONDAY, "15:40"), shift), true);
  });

  it("a day off is always outside of schedule", () => {
    assert.equal(isOffSchedule(lima(SUNDAY, "09:00"), null), true);
  });
});

describe("resolvePunchTime", () => {
  const receivedAt = lima(MONDAY, "07:30");

  it("online, the server's clock decides", () => {
    const result = resolvePunchTime({
      deviceAt: lima(MONDAY, "07:00"),
      sentAt: lima(MONDAY, "07:00"),
      receivedAt,
      live: true,
      clockMovedBack: false,
    });
    assert.equal(result.at.getTime(), receivedAt.getTime());
    assert.equal(result.offline, false);
  });

  it("offline with a correct clock keeps the device time", () => {
    const result = resolvePunchTime({
      deviceAt: lima(MONDAY, "07:04"),
      sentAt: lima(MONDAY, "07:30"),
      receivedAt,
      live: false,
      clockMovedBack: false,
    });
    assert.equal(result.at.getTime(), lima(MONDAY, "07:04").getTime());
    assert.equal(result.offline, true);
    assert.equal(result.suspicious, false);
  });

  it("a clock moved 30 minutes back is corrected and flagged", () => {
    // Real arrival 07:30, tablet clock showing 07:00.
    const result = resolvePunchTime({
      deviceAt: lima(MONDAY, "07:00"),
      sentAt: lima(MONDAY, "07:10"),
      receivedAt: lima(MONDAY, "07:40"),
      live: false,
      clockMovedBack: false,
    });
    assert.equal(result.at.getTime(), lima(MONDAY, "07:30").getTime());
    assert.equal(result.suspicious, true);
  });

  it("a clock that went backwards is flagged even if fixed before syncing", () => {
    const result = resolvePunchTime({
      deviceAt: lima(MONDAY, "07:00"),
      sentAt: receivedAt,
      receivedAt,
      live: false,
      clockMovedBack: true,
    });
    assert.equal(result.suspicious, true);
  });

  it("never in the future", () => {
    const result = resolvePunchTime({
      deviceAt: lima(MONDAY, "08:00"),
      sentAt: receivedAt,
      receivedAt,
      live: false,
      clockMovedBack: false,
    });
    assert.equal(result.at.getTime(), receivedAt.getTime());
  });
});

describe("buildPersonDay", () => {
  const now = lima("2026-10-07", "12:00");

  it("on time, with the hours worked", () => {
    const day = buildPersonDay(MONDAY, juan, [record()], now, "2026-01-01");
    assert.equal(day.status, "on_time");
    assert.equal(day.workedMinutes, 478);
  });

  it("late", () => {
    const day = buildPersonDay(MONDAY, juan, [record({ lateMinutes: 25 })], now, "2026-01-01");
    assert.equal(day.status, "late");
    assert.equal(day.lateMinutes, 25);
  });

  it("a scheduled day without marks is an absence", () => {
    assert.equal(buildPersonDay(MONDAY, juan, [], now, "2026-01-01").status, "absent");
  });

  it("not an absence before the person existed, on a day off or in the future", () => {
    assert.equal(buildPersonDay(MONDAY, juan, [], now, "2026-10-06").status, "none");
    assert.equal(buildPersonDay(SUNDAY, juan, [], now, "2026-01-01").status, "day_off");
    assert.equal(buildPersonDay("2026-10-08", juan, [], now, "2026-01-01").status, "none");
  });

  it("today: pending within the tolerance, absent after it", () => {
    assert.equal(buildPersonDay(MONDAY, juan, [], lima(MONDAY, "07:05"), "2026-01-01").status, "pending");
    assert.equal(buildPersonDay(MONDAY, juan, [], lima(MONDAY, "07:30"), "2026-01-01").status, "absent");
  });

  it("open today is working; an old open one has no exit", () => {
    const open = record({ clockOutAt: null, status: "open" });
    assert.equal(buildPersonDay(MONDAY, juan, [open], lima(MONDAY, "10:00"), "2026-01-01").status, "working");
    assert.equal(buildPersonDay(MONDAY, juan, [open], now, "2026-01-01").status, "no_clock_out");
    assert.equal(buildPersonDay(MONDAY, juan, [open], now, "2026-01-01").workedMinutes, 0);
  });

  it("worked on a day off", () => {
    const sunday = record({
      workDate: SUNDAY,
      clockInAt: lima(SUNDAY, "09:00"),
      clockOutAt: lima(SUNDAY, "13:00"),
    });
    assert.equal(buildPersonDay(SUNDAY, juan, [sunday], now, "2026-01-01").status, "extra");
  });

  it("two workdays on the same date add up; lateness is from the first", () => {
    const day = buildPersonDay(
      MONDAY,
      juan,
      [
        record({ clockInAt: lima(MONDAY, "12:00"), clockOutAt: lima(MONDAY, "15:00") }),
        record({ clockInAt: lima(MONDAY, "07:20"), clockOutAt: lima(MONDAY, "11:00"), lateMinutes: 20 }),
      ],
      now,
      "2026-01-01",
    );
    assert.equal(day.workedMinutes, 220 + 180);
    assert.equal(day.lateMinutes, 20);
  });

  it("a corrected record is reported as corrected", () => {
    const day = buildPersonDay(MONDAY, juan, [record({ isCorrected: true })], now, "2026-01-01");
    assert.equal(day.corrected, true);
  });
});

describe("summarizeDays", () => {
  it("totals for the report", () => {
    const now = lima("2026-10-07", "20:00");
    const days = dateKeysBetween(SUNDAY, "2026-10-07").map((key) =>
      buildPersonDay(
        key,
        juan,
        key === MONDAY
          ? [record({ lateMinutes: 15 })]
          : key === "2026-10-07"
            ? [record({ workDate: key, clockInAt: lima(key, "07:00"), clockOutAt: lima(key, "15:00") })]
            : [],
        now,
        "2026-01-01",
      ),
    );
    const totals = summarizeDays(days);
    assert.equal(totals.daysWorked, 2);
    assert.equal(totals.absences, 1); // Tuesday
    assert.equal(totals.lateCount, 1);
    assert.equal(totals.lateMinutes, 15);
    assert.equal(totals.workedMinutes, 478 + 480);
  });
});

describe("calendar helpers", () => {
  it("monthRange knows the last day", () => {
    assert.deepEqual(monthRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
    assert.deepEqual(monthRange("2026-10"), { from: "2026-10-01", to: "2026-10-31" });
  });

  it("monthGrid starts the week on Monday", () => {
    // 2026-10-01 is a Thursday.
    const weeks = monthGrid("2026-10");
    assert.deepEqual(weeks[0], [null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    assert.equal(weeks.flat().filter(Boolean).length, 31);
    assert.ok(weeks.every((week) => week.length === 7));
  });

  it("formatMinutes", () => {
    assert.equal(formatMinutes(485), "8 h 05 min");
    assert.equal(formatMinutes(42), "42 min");
  });
});

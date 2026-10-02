"use client";

import { createContext, useContext } from "react";
import type { AttendanceTodayState } from "@/domain/entities/attendance";
import type { UserRole } from "@/domain/entities/user";
import { useAttendance, type AttendanceController } from "@/hooks/use-attendance";

type AttendanceContextValue = AttendanceController & {
  userId: number;
  name: string;
  role: UserRole;
};

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

// Shared by the header badge ("Entrada 07:04 · Marcar salida") and the gate
// that asks to mark the entrance before showing the area.
export function AttendanceProvider({
  userId,
  name,
  role,
  initial,
  children,
}: {
  userId: number;
  name: string;
  role: UserRole;
  // What the server knew when the page was rendered (null offline).
  initial: AttendanceTodayState | null;
  children: React.ReactNode;
}) {
  const attendance = useAttendance(userId, initial);
  return (
    <AttendanceContext.Provider value={{ ...attendance, userId, name, role }}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendanceContext() {
  const value = useContext(AttendanceContext);
  if (!value) throw new Error("useAttendanceContext needs an AttendanceProvider");
  return value;
}

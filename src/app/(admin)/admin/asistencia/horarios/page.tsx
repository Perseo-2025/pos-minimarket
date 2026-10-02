import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { listSchedulesUseCase } from "@/application/use-cases/attendance/schedules";
import { AttendanceNav } from "@/components/admin/attendance/attendance-nav";
import { ScheduleEditor } from "@/components/admin/attendance/schedule-editor";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { USER_ROLE_LABELS } from "@/domain/entities/user";
import { attendanceDeps } from "@/infrastructure/deps";
import { attendanceRepository } from "@/infrastructure/repositories";

// Weekly schedule of each cashier and warehouse keeper: it decides who was
// late, who left early and who missed a day.
export default async function SchedulesPage() {
  const [people, schedules, pending] = await Promise.all([
    attendanceRepository.listPeople(),
    listSchedulesUseCase(attendanceDeps),
    attendanceRepository.countPendingCorrections(),
  ]);
  const active = people.filter((p) => p.isActive && p.role !== "admin");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Horarios"
        description="Qué días trabaja cada persona y a qué hora entra y sale. Sin horario, no se cuentan tardanzas ni faltas."
      />
      <AttendanceNav current="horarios" pendingCorrections={pending} />
      {active.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Todavía no hay personal"
          description="Crea usuarios con rol Cajero o Almacenero para asignarles un horario."
          action={
            <Button nativeButton={false} render={<Link href="/admin/users" />}>
              Ir a Usuarios
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {active.map((person) => (
            <ScheduleEditor
              key={person.id}
              person={{ id: person.id, name: person.name, roleLabel: USER_ROLE_LABELS[person.role] }}
              schedules={schedules.filter((s) => s.userId === person.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

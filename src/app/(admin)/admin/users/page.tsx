import { listUsersUseCase } from "@/application/use-cases/users/list-users";
import { PageHeader } from "@/components/admin/page-header";
import { UserForm } from "@/components/admin/user-form";
import { UserTable } from "@/components/admin/user-table";
import { userRepository } from "@/infrastructure/repositories";

export default async function AdminUsersPage() {
  const allUsers = await listUsersUseCase(userRepository);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        description="Cuentas con acceso a caja y administración."
        action={<UserForm />}
      />
      <UserTable
        users={allUsers.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          role: u.role,
          isActive: u.isActive,
        }))}
      />
    </div>
  );
}

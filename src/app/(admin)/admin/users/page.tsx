import { listUsersUseCase } from "@/application/use-cases/users/list-users";
import { UserForm } from "@/components/admin/user-form";
import { UserTable } from "@/components/admin/user-table";
import { userRepository } from "@/infrastructure/repositories";

export default async function AdminUsersPage() {
  const allUsers = await listUsersUseCase(userRepository);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <UserForm />
      </div>
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

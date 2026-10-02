import { z } from "zod";
import { USER_ROLES } from "@/domain/entities/user";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const userCreateSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(8),
  role: z.enum(USER_ROLES),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;

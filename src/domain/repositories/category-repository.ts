import type {
  Category,
  CategoryIcon,
  CategoryWithCounts,
} from "../entities/category";

export interface CategoryData {
  name: string;
  icon: CategoryIcon | null;
  sortOrder: number;
  tracksExpiry: boolean;
  expiryWarningDays: number;
}

export interface CategoryRepository {
  findAllWithCounts(): Promise<CategoryWithCounts[]>;
  findActive(): Promise<Category[]>;
  findById(id: number): Promise<Category | null>;
  // Case-insensitive; excludeId lets an update keep its own name.
  existsByName(name: string, excludeId?: number): Promise<boolean>;
  create(data: CategoryData): Promise<void>;
  update(id: number, data: CategoryData): Promise<void>;
  setActive(id: number, isActive: boolean): Promise<void>;
}

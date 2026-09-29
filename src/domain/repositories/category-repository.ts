import type {
  Category,
  CategoryIcon,
  CategoryWithCounts,
} from "../entities/category";

export interface CategoryData {
  name: string;
  icon: CategoryIcon | null;
  sortOrder: number;
}

export interface CategoryRepository {
  findAllWithCounts(): Promise<CategoryWithCounts[]>;
  findActive(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  // Case-insensitive; excludeId lets an update keep its own name.
  existsByName(name: string, excludeId?: string): Promise<boolean>;
  create(data: CategoryData): Promise<void>;
  update(id: string, data: CategoryData): Promise<void>;
  setActive(id: string, isActive: boolean): Promise<void>;
}

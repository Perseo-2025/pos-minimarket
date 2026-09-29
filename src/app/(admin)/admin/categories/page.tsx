import { PlusIcon } from "lucide-react";
import { Suspense } from "react";
import { listCategoriesWithCountsUseCase } from "@/application/use-cases/categories/list-categories";
import { CategoryForm } from "@/components/admin/categories/category-form";
import { CategoryTable } from "@/components/admin/categories/category-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryRepository } from "@/infrastructure/repositories";

async function CategoriesContent() {
  const categories = await listCategoriesWithCountsUseCase(categoryRepository);
  const nextSortOrder =
    categories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categorías"
        description="Organiza los productos que se muestran en caja."
        action={
          <CategoryForm
            nextSortOrder={nextSortOrder}
            trigger={
              <Button>
                <PlusIcon data-icon="inline-start" />
                Nueva categoría
              </Button>
            }
          />
        }
      />
      <CategoryTable categories={categories} />
    </div>
  );
}

export default function AdminCategoriesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <CategoriesContent />
    </Suspense>
  );
}

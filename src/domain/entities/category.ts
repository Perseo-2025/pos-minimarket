// Fixed set of icon keys a category can use. Stored as plain text in the DB;
// the presentation layer maps each key to an icon component.
export const CATEGORY_ICONS = [
  "bebidas",
  "licores",
  "cervezas",
  "cafe",
  "snacks",
  "dulces",
  "helados",
  "panaderia",
  "abarrotes",
  "lacteos",
  "huevos",
  "carnes",
  "pescados",
  "frutas",
  "verduras",
  "alimentos",
  "comidas",
  "limpieza",
  "higiene",
  "bebes",
  "farmacia",
  "mascotas",
  "regalos",
  "adornos",
  "utiles",
  "pilas",
  "hogar",
  "otros",
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const CATEGORY_ICON_LABELS: Record<CategoryIcon, string> = {
  bebidas: "Bebidas",
  licores: "Licores",
  cervezas: "Cervezas",
  cafe: "Café",
  snacks: "Snacks",
  dulces: "Dulces",
  helados: "Helados",
  panaderia: "Panadería",
  abarrotes: "Abarrotes",
  lacteos: "Lácteos",
  huevos: "Huevos",
  carnes: "Carnes",
  pescados: "Pescados",
  frutas: "Frutas",
  verduras: "Verduras",
  alimentos: "Alimentos",
  comidas: "Comidas",
  limpieza: "Limpieza",
  higiene: "Higiene",
  bebes: "Bebés",
  farmacia: "Farmacia",
  mascotas: "Mascotas",
  regalos: "Regalos",
  adornos: "Adornos",
  utiles: "Útiles",
  pilas: "Pilas",
  hogar: "Hogar",
  otros: "Otros",
};

export interface Category {
  id: string;
  name: string;
  icon: CategoryIcon | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryWithCounts extends Category {
  productCount: number;
  activeProductCount: number;
}

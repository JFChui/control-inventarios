import Link from "next/link";
import { CategoryEditForm, CategoryForm } from "@/components/catalog/category-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function CategoriasPage() {
  await requireModule("categorias");

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, code, name, created_at")
    .order("code");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías"
        description="Los gerentes de Diseño y Estilo pueden agregar y editar categorías de producto."
      />

      <CategoryForm />

      <ul className="space-y-3">
        {(categories ?? []).map((c) => (
          <li
            key={c.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <CategoryEditForm category={c} />
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <Link href="/inventario/minimos" className="inline-block text-sm text-teal-800 hover:underline">
          Aplicar mínimos y unidades por categoría →
        </Link>
        <Link href="/inventario/nuevo" className="inline-block text-sm text-teal-800 hover:underline">
          Ir a crear producto →
        </Link>
      </div>
    </div>
  );
}

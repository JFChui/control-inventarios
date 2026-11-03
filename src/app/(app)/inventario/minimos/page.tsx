import Link from "next/link";
import { redirect } from "next/navigation";
import { BulkMinUnitForm } from "@/components/catalog/bulk-min-unit-form";
import { PageHeader } from "@/components/ui/page-header";
import { canManageCatalog } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function MinimosPage() {
  const { profile } = await requireModule("inventario");
  if (!canManageCatalog(profile?.role)) {
    redirect("/inventario");
  }

  const supabase = await createClient();
  const [{ data: categories }, { data: departments }] = await Promise.all([
    supabase.from("product_categories").select("id, code, name").order("code"),
    supabase
      .from("departments")
      .select("id, code, name")
      .eq("is_active", true)
      .order("code"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/inventario" className="text-sm text-zinc-500 hover:underline">
          ← Inventario
        </Link>
        <PageHeader
          title="Mínimos y unidades"
          description="Aplica un stock mínimo y/o una unidad a todos los productos activos de una categoría (y, si quieres, de un departamento)."
        />
      </div>
      <BulkMinUnitForm
        categories={categories ?? []}
        departments={departments ?? []}
      />
    </div>
  );
}

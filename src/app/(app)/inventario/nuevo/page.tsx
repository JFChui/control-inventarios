import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/catalog/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { canManageCatalog } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function NuevoProductoPage() {
  const { profile } = await requireModule("inventario");
  if (!canManageCatalog(profile?.role)) {
    redirect("/inventario");
  }

  const supabase = await createClient();
  const [{ data: categories }, { data: departments }] = await Promise.all([
    supabase.from("product_categories").select("id, code, name").order("code"),
    supabase.from("departments").select("id, code, name").order("code"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/inventario" className="text-sm text-zinc-500 hover:underline">
          ← Inventario
        </Link>
        <PageHeader
          title="Nuevo producto"
          description="El stock inicia en 0. Luego registra una entrada en Movimientos."
        />
      </div>
      <ProductForm
        categories={categories ?? []}
        departments={departments ?? []}
      />
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductForm } from "@/components/catalog/product-form";
import { canManageCatalog } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireModule("inventario");
  if (!canManageCatalog(profile?.role)) {
    redirect("/inventario");
  }

  const { id } = await params;
  const supabase = await createClient();
  const [
    { data: product },
    { data: links },
    { data: categories },
    { data: departments },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, code, name, category_id, unit, min_stock, is_active")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("product_departments")
      .select("department_id")
      .eq("product_id", id),
    supabase.from("product_categories").select("id, code, name").order("code"),
    supabase.from("departments").select("id, code, name").order("code"),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/inventario/${id}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Kardex
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Editar producto
        </h1>
        <p className="mt-1 font-mono text-sm text-zinc-500">{product.code}</p>
      </div>
      <ProductForm
        categories={categories ?? []}
        departments={departments ?? []}
        initial={{
          id: product.id,
          code: product.code,
          name: product.name,
          category_id: product.category_id,
          unit: product.unit,
          min_stock: Number(product.min_stock),
          is_active: product.is_active,
          department_ids: (links ?? []).map((row) => row.department_id),
        }}
      />
    </div>
  );
}

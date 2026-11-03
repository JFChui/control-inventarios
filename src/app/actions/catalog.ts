"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import { createClient } from "@/lib/supabase/server";
import { diffDepartmentAssignments } from "@/lib/catalog/product-departments";
import {
  CATEGORY_CODE_TAKEN,
  CATEGORY_ID_REQUIRED,
  PRODUCT_CODE_TAKEN,
  PRODUCT_DEPARTMENT_SYNC_FAILED,
  PRODUCT_ID_REQUIRED,
  isCodeTaken,
  isUniqueViolation,
  parseBulkMinUnit,
  parseCategoryWrite,
  parseProductWrite,
} from "@/lib/catalog/rules";

export type ActionState = {
  error?: string;
  success?: string;
};

const FORBIDDEN_CATEGORY = "No tienes permiso para crear categorías.";
const FORBIDDEN_PRODUCT = "No tienes permiso para crear productos.";
const FORBIDDEN_MANAGE = "No tienes permiso para gestionar el catálogo.";

function revalidateCatalog(productId?: string | null) {
  revalidatePath("/inventario");
  revalidatePath("/categorias");
  revalidatePath("/alertas");
  revalidatePath("/");
  if (productId) {
    revalidatePath(`/inventario/${productId}`);
    revalidatePath(`/inventario/${productId}/editar`);
  }
}

async function requireCatalogManager() {
  const gate = await requireModuleAction("categorias");
  if (!gate.ok) {
    return { error: gate.error, supabase: null };
  }
  const supabase = await createClient();
  return { error: null, supabase };
}

async function findCategoryIdByCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  code: string,
) {
  const { data } = await supabase
    .from("product_categories")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return data?.id ?? null;
}

async function findProductIdByCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  code: string,
) {
  const { data } = await supabase
    .from("products")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return data?.id ?? null;
}

async function syncProductDepartments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  departmentIds: string[],
): Promise<{ error?: string }> {
  const { data: current, error: loadError } = await supabase
    .from("product_departments")
    .select("department_id")
    .eq("product_id", productId);

  if (loadError) {
    return { error: toActionError(loadError, PRODUCT_DEPARTMENT_SYNC_FAILED) };
  }

  const { toDelete, toInsert } = diffDepartmentAssignments(
    (current ?? []).map((row) => row.department_id),
    departmentIds,
  );

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("product_departments")
      .delete()
      .eq("product_id", productId)
      .in("department_id", toDelete);
    if (error) {
      return { error: toActionError(error, PRODUCT_DEPARTMENT_SYNC_FAILED) };
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("product_departments").insert(
      toInsert.map((department_id) => ({
        product_id: productId,
        department_id,
      })),
    );
    if (error) {
      return { error: toActionError(error, PRODUCT_DEPARTMENT_SYNC_FAILED) };
    }
  }

  return {};
}

async function loadProductDepartmentIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
): Promise<{ ids: string[]; error?: string }> {
  const { data, error } = await supabase
    .from("product_departments")
    .select("department_id")
    .eq("product_id", productId);
  if (error) {
    return {
      ids: [],
      error: toActionError(error, "No se pudieron leer los departamentos del producto."),
    };
  }
  return { ids: (data ?? []).map((row) => row.department_id) };
}

type ProductSnapshot = {
  code: string;
  name: string;
  category_id: string;
  unit: string;
  min_stock: number;
  is_active: boolean;
};

async function loadProductSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
): Promise<{
  snapshot: ProductSnapshot | null;
  departmentIds: string[];
  error?: string;
}> {
  const [{ data: product, error: productError }, departments] = await Promise.all([
    supabase
      .from("products")
      .select("code, name, category_id, unit, min_stock, is_active")
      .eq("id", productId)
      .maybeSingle(),
    loadProductDepartmentIds(supabase, productId),
  ]);
  if (productError) {
    return {
      snapshot: null,
      departmentIds: [],
      error: toActionError(productError, "No se pudo leer el producto."),
    };
  }
  if (departments.error) {
    return { snapshot: product, departmentIds: [], error: departments.error };
  }
  return { snapshot: product, departmentIds: departments.ids };
}

export async function createCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireCatalogManager();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? FORBIDDEN_CATEGORY };
  }

  const parsed = parseCategoryWrite({
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const existingId = await findCategoryIdByCode(gate.supabase, parsed.code);
  if (isCodeTaken(existingId)) {
    return { error: CATEGORY_CODE_TAKEN };
  }

  const { error } = await gate.supabase
    .from("product_categories")
    .insert({ code: parsed.code, name: parsed.name });

  if (error) {
    if (isUniqueViolation(error)) return { error: CATEGORY_CODE_TAKEN };
    return { error: toActionError(error, "No se pudo crear la categoría.") };
  }

  revalidateCatalog();
  return { success: "Categoría creada." };
}

export async function updateCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireCatalogManager();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? FORBIDDEN_MANAGE };
  }

  const parsed = parseCategoryWrite({
    id: String(formData.get("id") ?? ""),
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };
  if (!parsed.id) return { error: CATEGORY_ID_REQUIRED };

  const existingId = await findCategoryIdByCode(gate.supabase, parsed.code);
  if (isCodeTaken(existingId, parsed.id)) {
    return { error: CATEGORY_CODE_TAKEN };
  }

  const { error } = await gate.supabase
    .from("product_categories")
    .update({ code: parsed.code, name: parsed.name })
    .eq("id", parsed.id);

  if (error) {
    if (isUniqueViolation(error)) return { error: CATEGORY_CODE_TAKEN };
    return { error: toActionError(error, "No se pudo actualizar la categoría.") };
  }

  revalidateCatalog();
  return { success: "Categoría actualizada." };
}

export async function createProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireCatalogManager();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? FORBIDDEN_PRODUCT };
  }

  const parsed = parseProductWrite({
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    categoryId: String(formData.get("category_id") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    minStock: String(formData.get("min_stock") ?? "0"),
    departmentIds: formData.getAll("department_ids").map(String),
  });
  if (!parsed.ok) return { error: parsed.error };

  const existingId = await findProductIdByCode(gate.supabase, parsed.code);
  if (isCodeTaken(existingId)) {
    return { error: PRODUCT_CODE_TAKEN };
  }

  const { data, error } = await gate.supabase
    .from("products")
    .insert({
      code: parsed.code,
      name: parsed.name,
      category_id: parsed.categoryId,
      unit: parsed.unit,
      min_stock: parsed.minStock,
      quantity_on_hand: 0,
    })
    .select("id")
    .single();

  if (error) {
    if (isUniqueViolation(error)) return { error: PRODUCT_CODE_TAKEN };
    return { error: toActionError(error, "No se pudo crear el producto.") };
  }

  const sync = await syncProductDepartments(
    gate.supabase,
    data.id,
    parsed.departmentIds,
  );
  if (sync.error) {
    await gate.supabase.from("products").delete().eq("id", data.id);
    return { error: PRODUCT_DEPARTMENT_SYNC_FAILED };
  }

  revalidateCatalog(data.id);
  return { success: "Producto creado. Registra una entrada para cargar stock." };
}

export async function updateProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireCatalogManager();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? FORBIDDEN_MANAGE };
  }

  const parsed = parseProductWrite(
    {
      id: String(formData.get("id") ?? ""),
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      categoryId: String(formData.get("category_id") ?? ""),
      unit: String(formData.get("unit") ?? ""),
      minStock: String(formData.get("min_stock") ?? "0"),
      isActive: String(formData.get("is_active") ?? "true"),
      departmentIds: formData.getAll("department_ids").map(String),
    },
    { requireId: true },
  );
  if (!parsed.ok) return { error: parsed.error };
  const productId = parsed.id;
  if (!productId) return { error: PRODUCT_ID_REQUIRED };

  const existingId = await findProductIdByCode(gate.supabase, parsed.code);
  if (isCodeTaken(existingId, productId)) {
    return { error: PRODUCT_CODE_TAKEN };
  }

  const { snapshot, departmentIds: previousDepartmentIds, error: snapshotError } =
    await loadProductSnapshot(gate.supabase, productId);
  if (snapshotError) return { error: snapshotError };
  if (!snapshot) {
    return { error: "Producto no encontrado." };
  }

  const { error } = await gate.supabase
    .from("products")
    .update({
      code: parsed.code,
      name: parsed.name,
      category_id: parsed.categoryId,
      unit: parsed.unit,
      min_stock: parsed.minStock,
      is_active: parsed.isActive,
    })
    .eq("id", productId);

  if (error) {
    if (isUniqueViolation(error)) return { error: PRODUCT_CODE_TAKEN };
    return { error: toActionError(error, "No se pudo actualizar el producto.") };
  }

  const sync = await syncProductDepartments(
    gate.supabase,
    productId,
    parsed.departmentIds,
  );
  if (sync.error) {
    await gate.supabase.from("products").update(snapshot).eq("id", productId);
    await syncProductDepartments(
      gate.supabase,
      productId,
      previousDepartmentIds,
    );
    return { error: PRODUCT_DEPARTMENT_SYNC_FAILED };
  }

  revalidateCatalog(productId);
  return { success: "Producto actualizado." };
}

export async function bulkUpdateMinAndUnit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireCatalogManager();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? FORBIDDEN_MANAGE };
  }

  const parsed = parseBulkMinUnit({
    categoryId: String(formData.get("category_id") ?? ""),
    departmentId: String(formData.get("department_id") ?? ""),
    minStock: String(formData.get("min_stock") ?? ""),
    unit: String(formData.get("unit") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  let ids: string[] | null = null;
  if (parsed.departmentId) {
    const { data: links, error: linksError } = await gate.supabase
      .from("product_departments")
      .select("product_id")
      .eq("department_id", parsed.departmentId);
    if (linksError) {
      return { error: toActionError(linksError, "No se pudieron leer los productos del departamento.") };
    }
    ids = (links ?? []).map((row) => row.product_id);
    if (ids.length === 0) {
      return { error: "Ese departamento no tiene productos habilitados." };
    }
  }

  const patch: { min_stock?: number; unit?: string } = {};
  if (parsed.minStock != null) patch.min_stock = parsed.minStock;
  if (parsed.unit) patch.unit = parsed.unit;

  let query = gate.supabase
    .from("products")
    .update(patch)
    .eq("category_id", parsed.categoryId)
    .eq("is_active", true);

  if (ids) {
    query = query.in("id", ids);
  }

  const { data, error } = await query.select("id");
  if (error) {
    return { error: toActionError(error, "No se pudieron actualizar los mínimos.") };
  }
  if (!data?.length) {
    return { error: "No hay productos activos en ese alcance." };
  }

  revalidateCatalog();
  return {
    success: `Se actualizaron ${data.length} producto${data.length === 1 ? "" : "s"} activos. La existencia no cambió.`,
  };
}

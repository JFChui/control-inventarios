import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("departments").select("id").limit(1);
    if (error) {
      return Response.json({ ok: false }, { status: 503 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

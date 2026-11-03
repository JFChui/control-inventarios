import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthRedirect } from "@/lib/auth/redirect";

function redirectWithCookies(url: URL, from: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { is_active: boolean; must_change_password: boolean } | null =
    null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("is_active, must_change_password")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  }

  const redirect = resolveAuthRedirect({
    hasUser: Boolean(user),
    pathname: request.nextUrl.pathname,
    profile,
  });

  if (!redirect) {
    return supabaseResponse;
  }

  if (redirect.signOut) {
    await supabase.auth.signOut();
  }

  const url = request.nextUrl.clone();
  url.pathname = redirect.destination;
  url.search = "";
  if (redirect.error) {
    url.searchParams.set("error", redirect.error);
  }
  return redirectWithCookies(url, supabaseResponse);
}

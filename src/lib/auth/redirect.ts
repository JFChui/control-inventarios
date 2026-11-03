export type AuthProfile = {
  is_active: boolean;
  must_change_password: boolean;
};

export type AuthRedirect = {
  destination: "/" | "/login" | "/cambiar-password";
  error?: "inactive";
  signOut?: true;
};

export function resolveAuthRedirect(_input: {
  hasUser: boolean;
  pathname: string;
  profile: AuthProfile | null;
}): AuthRedirect | null {
  const { hasUser, pathname, profile } = _input;
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");
  const isChangePassword = pathname === "/cambiar-password";
  const isPublicHealth = pathname === "/api/health";

  if (isPublicHealth) {
    return null;
  }

  if (hasUser && (!profile || !profile.is_active)) {
    return {
      destination: "/login",
      error: "inactive",
      signOut: true,
    };
  }

  if (
    hasUser &&
    profile?.must_change_password &&
    !isChangePassword &&
    !isLogin
  ) {
    return { destination: "/cambiar-password" };
  }

  if (!hasUser && !isLogin) {
    return { destination: "/login" };
  }

  if (hasUser && isLogin) {
    return {
      destination: profile?.must_change_password ? "/cambiar-password" : "/",
    };
  }

  return null;
}

import { describe, expect, it } from "vitest";
import { resolveAuthRedirect } from "@/lib/auth/redirect";

describe("resolveAuthRedirect", () => {
  it("sends an unauthenticated protected request to login", () => {
    expect(
      resolveAuthRedirect({
        hasUser: false,
        pathname: "/inventario",
        profile: null,
      }),
    ).toEqual({ destination: "/login" });
  });

  it("lets an unauthenticated health check remain public", () => {
    expect(
      resolveAuthRedirect({
        hasUser: false,
        pathname: "/api/health",
        profile: null,
      }),
    ).toBeNull();
  });

  it("lets an unauthenticated request remain on login", () => {
    expect(
      resolveAuthRedirect({
        hasUser: false,
        pathname: "/login",
        profile: null,
      }),
    ).toBeNull();
  });

  it("lets an active user continue to a protected route", () => {
    expect(
      resolveAuthRedirect({
        hasUser: true,
        pathname: "/inventario",
        profile: { is_active: true, must_change_password: false },
      }),
    ).toBeNull();
  });

  it("signs out an authenticated user whose profile is inactive", () => {
    expect(
      resolveAuthRedirect({
        hasUser: true,
        pathname: "/inventario",
        profile: { is_active: false, must_change_password: false },
      }),
    ).toEqual({
      destination: "/login",
      error: "inactive",
      signOut: true,
    });
  });

  it("signs out an authenticated user whose profile is hidden", () => {
    expect(
      resolveAuthRedirect({
        hasUser: true,
        pathname: "/login",
        profile: null,
      }),
    ).toEqual({
      destination: "/login",
      error: "inactive",
      signOut: true,
    });
  });

  it("forces an active user with a temporary password to change it", () => {
    expect(
      resolveAuthRedirect({
        hasUser: true,
        pathname: "/inventario",
        profile: { is_active: true, must_change_password: true },
      }),
    ).toEqual({ destination: "/cambiar-password" });
  });

  it("does not redirect the forced-password screen to itself", () => {
    expect(
      resolveAuthRedirect({
        hasUser: true,
        pathname: "/cambiar-password",
        profile: { is_active: true, must_change_password: true },
      }),
    ).toBeNull();
  });

  it("sends an active user away from login", () => {
    expect(
      resolveAuthRedirect({
        hasUser: true,
        pathname: "/login",
        profile: { is_active: true, must_change_password: false },
      }),
    ).toEqual({ destination: "/" });
  });
});

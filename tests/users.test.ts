import { describe, expect, it, vi } from "vitest";
import { finalizeUserProvisioning } from "@/lib/users/provision";
import {
  PASSWORD_MISMATCH,
  PASSWORD_TOO_SHORT,
  TEMP_PASSWORD_SUFFIX,
  USER_EMAIL_INVALID,
  USER_FIELDS_REQUIRED,
  USER_ID_REQUIRED,
  USER_ROLE_INVALID,
  USER_SELF_DEACTIVATE,
  USER_SELF_DEMOTE,
  assertNotSelfLockout,
  canResetUserPassword,
  generateTempPassword,
  isAppRole,
  parseChangePassword,
  parseCreateUser,
  parseProfileUpdate,
} from "@/lib/users/rules";

describe("generateTempPassword", () => {
  it("uses the first 12 characters of a UUID plus Aa1!", () => {
    expect(generateTempPassword("abcdefghijkl-rest-of-uuid")).toBe(
      `abcdefghijkl${TEMP_PASSWORD_SUFFIX}`,
    );
  });

  it("is 16 characters and ends with Aa1! for a real UUID", () => {
    const password = generateTempPassword();
    expect(password).toHaveLength(16);
    expect(password.endsWith(TEMP_PASSWORD_SUFFIX)).toBe(true);
  });
});

describe("isAppRole", () => {
  it("accepts assignable cargo roles", () => {
    expect(isAppRole("senior_design_manager")).toBe(true);
    expect(isAppRole("design_manager")).toBe(true);
    expect(isAppRole("hr_manager")).toBe(true);
    expect(isAppRole("laundry_supervisor")).toBe(true);
    expect(isAppRole("floor_supervisor_a")).toBe(true);
    expect(isAppRole("mrla")).toBe(true);
  });

  it("rejects legacy and unknown roles", () => {
    expect(isAppRole("admin")).toBe(false);
    expect(isAppRole("department_user")).toBe(false);
    expect(isAppRole("human_resources")).toBe(false);
    expect(isAppRole("supervisor")).toBe(false);
    expect(isAppRole("")).toBe(false);
  });
});

describe("parseCreateUser", () => {
  it("requires email, full name and role", () => {
    expect(
      parseCreateUser({
        email: "  ",
        fullName: "Ana",
        role: "floor_supervisor_a",
        departmentId: "",
      }),
    ).toEqual({ ok: false, error: USER_FIELDS_REQUIRED });
    expect(
      parseCreateUser({
        email: "ana@hotel.com",
        fullName: "   ",
        role: "floor_supervisor_a",
        departmentId: "",
      }),
    ).toEqual({ ok: false, error: USER_FIELDS_REQUIRED });
  });

  it("rejects an email without @", () => {
    expect(
      parseCreateUser({
        email: "ana.hotel.com",
        fullName: "Ana",
        role: "mrla",
        departmentId: "",
      }),
    ).toEqual({ ok: false, error: USER_EMAIL_INVALID });
  });

  it("rejects an unknown role", () => {
    expect(
      parseCreateUser({
        email: "ana@hotel.com",
        fullName: "Ana",
        role: "supervisor",
        departmentId: "",
      }),
    ).toEqual({ ok: false, error: USER_ROLE_INVALID });
  });

  it("normalizes email, name and optional department", () => {
    expect(
      parseCreateUser({
        email: "  Ana@Hotel.COM ",
        fullName: "  Ana Pérez  ",
        role: "hr_manager",
        departmentId: "  dept-1  ",
      }),
    ).toEqual({
      ok: true,
      email: "ana@hotel.com",
      fullName: "Ana Pérez",
      role: "hr_manager",
      departmentId: "dept-1",
    });
    expect(
      parseCreateUser({
        email: "ana@hotel.com",
        fullName: "Ana",
        role: "senior_design_manager",
        departmentId: "",
      }),
    ).toMatchObject({ ok: true, departmentId: null });
  });
});

describe("parseProfileUpdate", () => {
  it("requires a user id and a valid role", () => {
    expect(
      parseProfileUpdate({
        id: "",
        fullName: "Ana",
        role: "senior_design_manager",
        departmentId: "",
        isActive: "on",
      }),
    ).toEqual({ ok: false, error: USER_ID_REQUIRED });
    expect(
      parseProfileUpdate({
        id: "user-1",
        fullName: "Ana",
        role: "staff",
        departmentId: "",
        isActive: "on",
      }),
    ).toEqual({ ok: false, error: USER_ROLE_INVALID });
  });

  it("treats a missing checkbox as inactive", () => {
    expect(
      parseProfileUpdate({
        id: "user-1",
        fullName: "  Ana  ",
        role: "mrla",
        departmentId: "",
        isActive: null,
      }),
    ).toEqual({
      ok: true,
      id: "user-1",
      fullName: "Ana",
      role: "mrla",
      departmentId: null,
      isActive: false,
    });
  });

  it("treats on/true as active", () => {
    expect(
      parseProfileUpdate({
        id: "user-1",
        fullName: "",
        role: "floor_supervisor_a",
        departmentId: "dept-1",
        isActive: "on",
      }),
    ).toMatchObject({ ok: true, fullName: null, isActive: true });
  });
});

describe("parseChangePassword", () => {
  it("requires at least 8 characters", () => {
    expect(parseChangePassword({ password: "Aa1!", confirm: "Aa1!" })).toEqual({
      ok: false,
      error: PASSWORD_TOO_SHORT,
    });
  });

  it("requires confirmation to match", () => {
    expect(
      parseChangePassword({ password: "NuevaClave1", confirm: "OtraClave1" }),
    ).toEqual({ ok: false, error: PASSWORD_MISMATCH });
  });

  it("accepts a matching password of 8+ characters", () => {
    expect(
      parseChangePassword({ password: "NuevaClave1", confirm: "NuevaClave1" }),
    ).toEqual({ ok: true, password: "NuevaClave1" });
  });
});

describe("assertNotSelfLockout", () => {
  it("blocks a manager from deactivating or demoting themselves", () => {
    expect(
      assertNotSelfLockout({
        actorId: "mgr-1",
        targetId: "mgr-1",
        nextRole: "senior_design_manager",
        nextIsActive: false,
      }),
    ).toEqual({ ok: false, error: USER_SELF_DEACTIVATE });
    expect(
      assertNotSelfLockout({
        actorId: "mgr-1",
        targetId: "mgr-1",
        nextRole: "floor_supervisor_a",
        nextIsActive: true,
      }),
    ).toEqual({ ok: false, error: USER_SELF_DEMOTE });
  });

  it("allows editing another user or keeping own manager role", () => {
    expect(
      assertNotSelfLockout({
        actorId: "mgr-1",
        targetId: "user-2",
        nextRole: "floor_supervisor_a",
        nextIsActive: false,
      }),
    ).toEqual({ ok: true });
    expect(
      assertNotSelfLockout({
        actorId: "mgr-1",
        targetId: "mgr-1",
        nextRole: "design_manager",
        nextIsActive: true,
      }),
    ).toEqual({ ok: true });
  });
});

describe("canResetUserPassword", () => {
  it("never allows resetting the actor's own password from Usuarios", () => {
    expect(canResetUserPassword("mgr-1", "mgr-1")).toBe(false);
    expect(canResetUserPassword("mgr-1", "user-2")).toBe(true);
  });
});

describe("finalizeUserProvisioning", () => {
  it("deletes the Auth user when profile finalization fails", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null });

    const result = await finalizeUserProvisioning({
      userId: "auth-user-1",
      finalizeProfile: vi
        .fn()
        .mockResolvedValue({ error: { message: "profile update failed" } }),
      deleteUser,
    });

    expect(deleteUser).toHaveBeenCalledOnce();
    expect(deleteUser).toHaveBeenCalledWith("auth-user-1");
    expect(result).toEqual({ error: "profile update failed" });
  });

  it("does not delete the Auth user after successful finalization", async () => {
    const deleteUser = vi.fn();

    const result = await finalizeUserProvisioning({
      userId: "auth-user-1",
      finalizeProfile: vi.fn().mockResolvedValue({ error: null }),
      deleteUser,
    });

    expect(deleteUser).not.toHaveBeenCalled();
    expect(result).toEqual({ error: null });
  });

  it("reports when compensating deletion also fails", async () => {
    const result = await finalizeUserProvisioning({
      userId: "auth-user-1",
      finalizeProfile: vi
        .fn()
        .mockResolvedValue({ error: { message: "profile update failed" } }),
      deleteUser: vi
        .fn()
        .mockResolvedValue({ error: { message: "delete failed" } }),
    });

    expect(result).toEqual({
      error:
        "profile update failed No se pudo revertir el usuario: delete failed",
    });
  });
});

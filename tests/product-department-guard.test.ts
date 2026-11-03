import { describe, expect, it } from "vitest";
import {
  PRODUCT_NOT_ENABLED,
  USER_DEPARTMENT_REQUIRED,
  STOCK_INSUFFICIENT,
  assertDepartmentUserCanUseProduct,
  assertOutboundStock,
  diffDepartmentAssignments,
} from "@/lib/catalog/product-departments";

describe("assertDepartmentUserCanUseProduct", () => {
  it("blocks department_user when the product is not enabled for their department", () => {
    expect(
      assertDepartmentUserCanUseProduct({
        role: "department_user",
        userDepartmentId: "dept-ama",
        productDepartmentIds: ["dept-laundry"],
      }),
    ).toEqual({ ok: false, error: PRODUCT_NOT_ENABLED });
  });

  it("allows department_user when the product is enabled for their department", () => {
    expect(
      assertDepartmentUserCanUseProduct({
        role: "department_user",
        userDepartmentId: "dept-ama",
        productDepartmentIds: ["dept-laundry", "dept-ama"],
      }),
    ).toEqual({ ok: true });
  });

  it("skips the enablement check for admin and mrla", () => {
    expect(
      assertDepartmentUserCanUseProduct({
        role: "admin",
        userDepartmentId: null,
        productDepartmentIds: [],
      }),
    ).toEqual({ ok: true });
    expect(
      assertDepartmentUserCanUseProduct({
        role: "mrla",
        userDepartmentId: "dept-ama",
        productDepartmentIds: [],
      }),
    ).toEqual({ ok: true });
  });

  it("blocks department_user without a department", () => {
    expect(
      assertDepartmentUserCanUseProduct({
        role: "department_user",
        userDepartmentId: null,
        productDepartmentIds: ["dept-ama"],
      }),
    ).toEqual({ ok: false, error: USER_DEPARTMENT_REQUIRED });
  });
});

describe("diffDepartmentAssignments", () => {
  it("deletes unlisted rows and inserts missing ones", () => {
    expect(
      diffDepartmentAssignments(["a", "b", "c"], ["b", "d"]),
    ).toEqual({ toDelete: ["a", "c"], toInsert: ["d"] });
  });

  it("inserts all when current is empty", () => {
    expect(diffDepartmentAssignments([], ["a", "b"])).toEqual({
      toDelete: [],
      toInsert: ["a", "b"],
    });
  });

  it("deletes all when desired is empty", () => {
    expect(diffDepartmentAssignments(["a", "b"], [])).toEqual({
      toDelete: ["a", "b"],
      toInsert: [],
    });
  });

  it("dedupes desired ids and ignores blanks", () => {
    expect(
      diffDepartmentAssignments(["a"], ["a", "a", "", "b"]),
    ).toEqual({ toDelete: [], toInsert: ["b"] });
  });
});

describe("assertOutboundStock", () => {
  it("rejects an outbound quantity above on-hand", () => {
    expect(assertOutboundStock("out", 5, 4)).toEqual({
      ok: false,
      error: STOCK_INSUFFICIENT,
    });
  });

  it("allows outbound equal to on-hand and inbound always", () => {
    expect(assertOutboundStock("out", 4, 4)).toEqual({ ok: true });
    expect(assertOutboundStock("in", 100, 0)).toEqual({ ok: true });
  });
});

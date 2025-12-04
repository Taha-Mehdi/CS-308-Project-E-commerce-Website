import { statusActionVariant } from "../app/admin/orders/page";

describe("Admin Orders status action variant", () => {
  it("uses success styling for paid", () => {
    expect(statusActionVariant("paid")).toBe("success");
  });

  it("falls back to muted for unknown status", () => {
    expect(statusActionVariant("unknown")).toBe("muted");
  });
});

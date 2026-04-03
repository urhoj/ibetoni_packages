import { describe, it, expect, vi } from "vitest";
import KeikkaPermissionValidator from "../KeikkaPermissionValidator.js";

// --- Mock adapters ---

function createMockAdapters(permissions = {}) {
  const defaultPerms = {
    isAsiakasAdmin: false,
    isLaskuAdmin: false,
    isPumppari: false,
    isAttachmentHandler: false,
    isKeikkaHandler: false,
    isSijaintiHandler: false,
    isVehicleHandler: false,
    isTuoteHandler: false,
    isKeikkaViewer: false,
    isBetoniHandler: false,
    isBetoniViewer: false,
    isPumppuHandler: false,
    isPumppuViewer: false,
    ...permissions,
  };

  return {
    permissionDataAdapter: {
      getUserPermissions: vi.fn().mockResolvedValue(defaultPerms),
    },
    contactPersonAdapter: {
      hasContactPersonAccess: vi.fn().mockResolvedValue(false),
    },
    assignmentAdapter: {
      isPersonAssignedToKeikka: vi.fn().mockResolvedValue(false),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
}

const testUser = { personId: 1, ownerAsiakasId: 10 };

const testKeikka = {
  keikkaId: 100,
  sourceAsiakasId: 10,
  ownerAsiakasId: 10,
  betoniAsiakasId: 20,
  pumppuAsiakasId: 30,
  tilaId: 3,
};

// --- Constructor ---

describe("KeikkaPermissionValidator constructor", () => {
  it("creates instance with valid adapters", () => {
    const adapters = createMockAdapters();
    const validator = new KeikkaPermissionValidator(adapters);
    expect(validator).toBeDefined();
  });

  it("throws without permissionDataAdapter", () => {
    const adapters = createMockAdapters();
    delete adapters.permissionDataAdapter;
    expect(() => new KeikkaPermissionValidator(adapters)).toThrow("permissionDataAdapter");
  });

  it("throws without contactPersonAdapter", () => {
    const adapters = createMockAdapters();
    delete adapters.contactPersonAdapter;
    expect(() => new KeikkaPermissionValidator(adapters)).toThrow("contactPersonAdapter");
  });

  it("throws without assignmentAdapter", () => {
    const adapters = createMockAdapters();
    delete adapters.assignmentAdapter;
    expect(() => new KeikkaPermissionValidator(adapters)).toThrow("assignmentAdapter");
  });
});

// --- getEmptyPermissions ---

describe("getEmptyPermissions", () => {
  it("returns object with all 13 flags set to false", () => {
    const adapters = createMockAdapters();
    const validator = new KeikkaPermissionValidator(adapters);
    const perms = validator.getEmptyPermissions();
    expect(Object.keys(perms)).toHaveLength(13);
    expect(Object.values(perms).every((v) => v === false)).toBe(true);
  });
});

// --- getUserPermissions ---

describe("getUserPermissions", () => {
  it("returns empty permissions for null user", async () => {
    const adapters = createMockAdapters();
    const validator = new KeikkaPermissionValidator(adapters);
    const perms = await validator.getUserPermissions(null);
    expect(perms.isAsiakasAdmin).toBe(false);
  });

  it("fetches from adapter on first call", async () => {
    const adapters = createMockAdapters({ isAsiakasAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    const perms = await validator.getUserPermissions(testUser);
    expect(perms.isAsiakasAdmin).toBe(true);
    expect(adapters.permissionDataAdapter.getUserPermissions).toHaveBeenCalledOnce();
  });

  it("returns cached result on second call", async () => {
    const adapters = createMockAdapters({ isKeikkaHandler: true });
    const validator = new KeikkaPermissionValidator(adapters);
    await validator.getUserPermissions(testUser);
    await validator.getUserPermissions(testUser);
    expect(adapters.permissionDataAdapter.getUserPermissions).toHaveBeenCalledOnce();
  });

  it("returns empty permissions on adapter error", async () => {
    const adapters = createMockAdapters();
    adapters.permissionDataAdapter.getUserPermissions.mockRejectedValue(new Error("DB down"));
    const validator = new KeikkaPermissionValidator(adapters);
    const perms = await validator.getUserPermissions(testUser);
    expect(perms.isAsiakasAdmin).toBe(false);
  });
});

// --- clearPermissionCache ---

describe("clearPermissionCache", () => {
  it("clears specific user cache", async () => {
    const adapters = createMockAdapters({ isAsiakasAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    await validator.getUserPermissions(testUser);
    expect(validator.getCacheStatus().size).toBe(1);

    validator.clearPermissionCache(1, 10);
    expect(validator.getCacheStatus().size).toBe(0);
  });

  it("clears all cache for a personId", async () => {
    const adapters = createMockAdapters({ isAsiakasAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    await validator.getUserPermissions({ personId: 1, ownerAsiakasId: 10 });
    await validator.getUserPermissions({ personId: 1, ownerAsiakasId: 20 });
    expect(validator.getCacheStatus().size).toBe(2);

    validator.clearPermissionCache(1);
    expect(validator.getCacheStatus().size).toBe(0);
  });

  it("clears entire cache when no args", async () => {
    const adapters = createMockAdapters();
    const validator = new KeikkaPermissionValidator(adapters);
    await validator.getUserPermissions({ personId: 1, ownerAsiakasId: 10 });
    await validator.getUserPermissions({ personId: 2, ownerAsiakasId: 20 });

    validator.clearPermissionCache();
    expect(validator.getCacheStatus().size).toBe(0);
  });
});

// --- getCacheStatus ---

describe("getCacheStatus", () => {
  it("returns size and timeout", () => {
    const adapters = createMockAdapters();
    const validator = new KeikkaPermissionValidator(adapters);
    const status = validator.getCacheStatus();
    expect(status.size).toBe(0);
    expect(status.timeout).toBe(300000); // 5 minutes
  });
});

// --- canReadKeikka ---

describe("canReadKeikka", () => {
  it("returns false for null user or keikka", async () => {
    const adapters = createMockAdapters();
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canReadKeikka(null, testKeikka)).toBe(false);
    expect(await validator.canReadKeikka(testUser, null)).toBe(false);
  });

  it("admin can read own tenant keikka", async () => {
    const adapters = createMockAdapters({ isAsiakasAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canReadKeikka(testUser, testKeikka)).toBe(true);
  });

  it("admin cannot read unrelated tenant keikka", async () => {
    const adapters = createMockAdapters({ isAsiakasAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    const foreignKeikka = { keikkaId: 200, sourceAsiakasId: 99, ownerAsiakasId: 99, betoniAsiakasId: 99, pumppuAsiakasId: 99 };
    expect(await validator.canReadKeikka(testUser, foreignKeikka)).toBe(false);
  });

  it("pumppari can read assigned keikka", async () => {
    const adapters = createMockAdapters({ isPumppari: true });
    adapters.assignmentAdapter.isPersonAssignedToKeikka.mockResolvedValue(true);
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canReadKeikka(testUser, testKeikka)).toBe(true);
  });

  it("pumppari cannot read unassigned keikka", async () => {
    const adapters = createMockAdapters({ isPumppari: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canReadKeikka(testUser, testKeikka)).toBe(false);
  });

  it("keikkaHandler can read own tenant keikka", async () => {
    const adapters = createMockAdapters({ isKeikkaHandler: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canReadKeikka(testUser, testKeikka)).toBe(true);
  });

  it("keikkaViewer can read own tenant keikka", async () => {
    const adapters = createMockAdapters({ isKeikkaViewer: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canReadKeikka(testUser, testKeikka)).toBe(true);
  });

  it("betoniHandler can read keikka with betoni connection", async () => {
    const adapters = createMockAdapters({ isBetoniHandler: true });
    const validator = new KeikkaPermissionValidator(adapters);
    const keikka = { ...testKeikka, sourceAsiakasId: 10 };
    expect(await validator.canReadKeikka(testUser, keikka)).toBe(true);
  });

  it("pumppuViewer can read keikka with pumppu connection", async () => {
    const adapters = createMockAdapters({ isPumppuViewer: true });
    const validator = new KeikkaPermissionValidator(adapters);
    const keikka = { ...testKeikka, pumppuAsiakasId: 10 };
    expect(await validator.canReadKeikka(testUser, keikka)).toBe(true);
  });

  it("falls back to contact person access", async () => {
    const adapters = createMockAdapters();
    adapters.contactPersonAdapter.hasContactPersonAccess.mockResolvedValue(true);
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canReadKeikka(testUser, testKeikka)).toBe(true);
    expect(adapters.contactPersonAdapter.hasContactPersonAccess).toHaveBeenCalledWith(
      testUser, testKeikka, "read"
    );
  });
});

// --- canEditKeikka ---

describe("canEditKeikka", () => {
  it("returns false for null user or keikka", async () => {
    const adapters = createMockAdapters();
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(null, testKeikka)).toBe(false);
    expect(await validator.canEditKeikka(testUser, null)).toBe(false);
  });

  it("admin can edit keikka with tilaId < 7", async () => {
    const adapters = createMockAdapters({ isAsiakasAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 3 })).toBe(true);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 6 })).toBe(true);
  });

  it("admin cannot edit keikka with tilaId >= 7", async () => {
    const adapters = createMockAdapters({ isAsiakasAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 7 })).toBe(false);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 8 })).toBe(false);
  });

  it("admin cannot edit foreign tenant keikka even with tilaId < 7", async () => {
    const adapters = createMockAdapters({ isAsiakasAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    const foreignKeikka = { keikkaId: 200, sourceAsiakasId: 99, ownerAsiakasId: 99, betoniAsiakasId: 99, pumppuAsiakasId: 99, tilaId: 3 };
    expect(await validator.canEditKeikka(testUser, foreignKeikka)).toBe(false);
  });

  it("laskuAdmin cannot edit foreign tenant keikka even with tilaId === 7", async () => {
    const adapters = createMockAdapters({ isLaskuAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    const foreignKeikka = { keikkaId: 200, sourceAsiakasId: 99, ownerAsiakasId: 99, betoniAsiakasId: 99, pumppuAsiakasId: 99, tilaId: 7 };
    expect(await validator.canEditKeikka(testUser, foreignKeikka)).toBe(false);
  });

  it("laskuAdmin can edit keikka with tilaId === 7", async () => {
    const adapters = createMockAdapters({ isLaskuAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 7 })).toBe(true);
  });

  it("laskuAdmin cannot edit keikka with tilaId !== 7", async () => {
    const adapters = createMockAdapters({ isLaskuAdmin: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 3 })).toBe(false);
  });

  it("pumppari cannot edit any keikka", async () => {
    const adapters = createMockAdapters({ isPumppari: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 1 })).toBe(false);
  });

  it("keikkaHandler can edit own tenant keikka with tilaId < 7", async () => {
    const adapters = createMockAdapters({ isKeikkaHandler: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 3 })).toBe(true);
  });

  it("keikkaHandler cannot edit keikka with tilaId >= 7", async () => {
    const adapters = createMockAdapters({ isKeikkaHandler: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 7 })).toBe(false);
  });

  it("betoniHandler can edit betoni keikka with tilaId < 7", async () => {
    const adapters = createMockAdapters({ isBetoniHandler: true });
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 5 })).toBe(true);
  });

  it("pumppuHandler can edit pumppu keikka with tilaId < 7", async () => {
    const adapters = createMockAdapters({ isPumppuHandler: true });
    const validator = new KeikkaPermissionValidator(adapters);
    const keikka = { ...testKeikka, pumppuAsiakasId: 10, tilaId: 3 };
    expect(await validator.canEditKeikka(testUser, keikka)).toBe(true);
  });

  it("contact person can edit keikka with tilaId === 1", async () => {
    const adapters = createMockAdapters();
    adapters.contactPersonAdapter.hasContactPersonAccess.mockResolvedValue(true);
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 1 })).toBe(true);
  });

  it("contact person cannot edit keikka with tilaId > 1", async () => {
    const adapters = createMockAdapters();
    adapters.contactPersonAdapter.hasContactPersonAccess.mockResolvedValue(true);
    const validator = new KeikkaPermissionValidator(adapters);
    expect(await validator.canEditKeikka(testUser, { ...testKeikka, tilaId: 2 })).toBe(false);
  });
});

// roles.js ships TWICE (src/roles.js for import, src/roles.cjs via index.js for
// require). Both halves must agree, and every role that has a typeId must also
// produce a companyRoles key — a role present in ROLE_NAME_BY_TYPEID but absent
// from ROLE_NAME_TO_KEY_MAP is a gate nobody can pass (fb#1919: ilmoitustauluEditor).
import { describe, test, expect } from "vitest";
import cjs from "../../index.js";
import {
  ROLE_NAME_BY_TYPEID as esmByTypeId,
  ROLE_NAME_TO_KEY_MAP as esmKeyMap,
  buildCompanyRoles as esmBuild,
} from "../roles.js";

// Roles carried in the JWT that have no companyRoles CONSUMER (3/4/7 are staff
// roles nothing gates on yet; 20/21 are OBSOLETE). Keep the list explicit so a
// NEW omission fails loudly instead of silently becoming an unpassable gate.
const KEY_MAP_EXEMPT = new Set([
  "saaNähdäTarjouksen", // 3
  "saaNähdäHinnat", // 4
  "saaNähdäLaskun", // 7
  "pumppuHandler", // 20 OBSOLETE
  "pumppuViewer", // 21 OBSOLETE
]);

describe("ROLE_NAME_TO_KEY_MAP", () => {
  test("ilmoitustauluEditor (typeId 25) builds isIlmoitustauluEditor — the gate is reachable (fb#1919)", () => {
    expect(esmBuild(["ilmoitustauluEditor"]).isIlmoitustauluEditor).toBe(true);
    expect(cjs.buildCompanyRoles(["ilmoitustauluEditor"]).isIlmoitustauluEditor).toBe(true);
  });

  test("every typeId-bearing role (minus the exempt list) has a companyRoles key", () => {
    const missing = Object.values(esmByTypeId).filter(
      (name) => !KEY_MAP_EXEMPT.has(name) && !esmKeyMap[name]
    );
    expect(missing).toEqual([]);
  });

  test("the ESM and CJS halves agree", () => {
    expect(cjs.ROLE_NAME_TO_KEY_MAP).toEqual(esmKeyMap);
    expect(cjs.ROLE_NAME_BY_TYPEID).toEqual(esmByTypeId);
  });
});

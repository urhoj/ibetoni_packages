import { describe, it, expect } from "vitest";
import { classifyPrhStatus, PRH_STATUS } from "../index.js";

// Real-data-shaped fixtures (register/type/languageCode are strings, as PRH returns).
const reg1 = (type, desc, endDate = null) => ({
  register: "1", type, endDate,
  descriptions: [{ languageCode: "1", description: desc }],
});

describe("classifyPrhStatus", () => {
  it("healthy company (Nokia): reg1 current Rekisterissa -> ok", () => {
    const r = classifyPrhStatus({ status: "2", companySituations: [], registeredEntries: [reg1("1", "Rekisterissä")] });
    expect(r.status).toBe(PRH_STATUS.OK);
    expect(r.situation).toBe(null);
  });

  it("ceased company (Cafe Mido): reg1 current Lakannut -> dead", () => {
    const r = classifyPrhStatus({ status: "2", companySituations: [], registeredEntries: [
      reg1("1", "Rekisterissä", "2005-12-18"), reg1("4", "Lakannut"),
    ] });
    expect(r.status).toBe(PRH_STATUS.DEAD);
    expect(r.situation).toBe("lakannut");
  });

  it("active bankruptcy (Savcor): companySituations KONK -> dead, even while reg1 says Rekisterissa", () => {
    const r = classifyPrhStatus({ status: "2",
      companySituations: [{ type: "KONK", registrationDate: "2024-05-27", source: "1" }],
      registeredEntries: [reg1("1", "Rekisterissä")] });
    expect(r.status).toBe(PRH_STATUS.DEAD);
    expect(r.situation).toBe("konkurssi");
  });

  it("yrityssaneeraus code -> caution", () => {
    const r = classifyPrhStatus({ companySituations: [{ type: "SANE" }], registeredEntries: [reg1("1", "Rekisterissä")] });
    expect(r.status).toBe(PRH_STATUS.CAUTION);
    expect(r.situation).toBe("yrityssaneeraus");
  });

  it("unknown special-situation code -> caution (fail-safe, never silent ok)", () => {
    const r = classifyPrhStatus({ companySituations: [{ type: "XYZ9" }], registeredEntries: [reg1("1", "Rekisterissä")] });
    expect(r.status).toBe(PRH_STATUS.CAUTION);
  });

  it("selvitystila situation code -> dead", () => {
    const r = classifyPrhStatus({ companySituations: [{ type: "SELV" }], registeredEntries: [] });
    expect(r.status).toBe(PRH_STATUS.DEAD);
  });

  it("no active signal and nothing adverse -> unknown (do not assume ok)", () => {
    expect(classifyPrhStatus({ companySituations: [], registeredEntries: [] }).status).toBe(PRH_STATUS.UNKNOWN);
    expect(classifyPrhStatus({}).status).toBe(PRH_STATUS.UNKNOWN);
  });

  it("estate edge (reg1 current 'Ei rekisteröity perustaminen') -> caution, not ok", () => {
    const r = classifyPrhStatus({ registeredEntries: [reg1("3", "Ei rekisteröity perustaminen")] });
    expect(r.status).toBe(PRH_STATUS.CAUTION);
  });
});

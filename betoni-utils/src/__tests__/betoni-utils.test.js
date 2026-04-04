import { describe, it, expect } from "vitest";
import {
  removeEiTietoaFromBetoniString,
  betoni_getString,
  betoni_getString_noAttr,
  betoni_getStrings,
  betoni_getComprehensiveString,
  betoni_getComprehensiveString_noAttr,
} from "../betoniStringBuilder.js";
import { betoni_isComplete } from "../betoniValidator.js";
import { formatPersonName } from "../personUtils.js";
import {
  isEmail,
  parseMultipleEmails,
  validateMultipleEmails,
} from "../emailUtils.js";
import { getText, HAVERSINE_DISTANCE_M } from "../ecofleetUtils.js";
import { RasitusLuokatArr, WEATHER_RESISTANT_CLASSES } from "../constants.js";
import { escapeHtml } from "../htmlUtils.js";

// --- Test fixtures ---

const baseBetoni = {
  laatu: { laatuNimike: "Lattiabetoni" },
  raeKoko: { raeKokoSelite: "16mm" },
  lujuus: { lujuusSelite: "C25/30" },
  notkeus: { notkeusSelite: "S2" },
  kayttoIka: { kayttoIkaSelite: "50 vuotta" },
  rasitusluokat: ["XC1", "XC3"],
  laatuId: 1,
  raeKokoId: 1,
  lujuusId: 1,
  notkeusId: 1,
  kayttoIkaId: 1,
};

const betoniWithAttrs = {
  ...baseBetoni,
  attr: {
    attr: [
      {
        attrNimike: "Lisäaine1",
        keikkaBetoniAttrComment: "kommentti",
        keikkaBetoniAttrId: 1,
      },
      {
        attrNimike: "Lisäaine2",
        keikkaBetoniAttrComment: "",
        keikkaBetoniAttrId: 2,
      },
    ],
  },
  betoniComment: "Huom tärkeä",
};

const betoniWithVolume = {
  ...baseBetoni,
  m3: 5,
  isNopea: true,
  rasitusluokat: ["XF1", "XC3"],
};

// --- removeEiTietoaFromBetoniString ---

describe("removeEiTietoaFromBetoniString", () => {
  it("removes 'Ei tietoa' from string", () => {
    expect(
      removeEiTietoaFromBetoniString("Lattiabetoni Ei tietoa C25/30"),
    ).toBe("Lattiabetoni C25/30");
  });

  it("removes 'ei tietoa' (lowercase)", () => {
    expect(removeEiTietoaFromBetoniString("ei tietoa test")).toBe("test");
  });

  it("removes 'undefined' text", () => {
    expect(removeEiTietoaFromBetoniString("Lattiabetoni undefined S2")).toBe(
      "Lattiabetoni S2",
    );
  });

  it("returns empty string for null/undefined", () => {
    expect(removeEiTietoaFromBetoniString(null)).toBe("");
    expect(removeEiTietoaFromBetoniString(undefined)).toBe("");
    expect(removeEiTietoaFromBetoniString("")).toBe("");
  });

  it("normalizes multiple spaces", () => {
    expect(removeEiTietoaFromBetoniString("a   b    c")).toBe("a b c");
  });
});

// --- betoni_getString_noAttr ---

describe("betoni_getString_noAttr", () => {
  it("formats betoni with nested objects", () => {
    const result = betoni_getString_noAttr(baseBetoni);
    expect(result).toContain("Lattiabetoni");
    expect(result).toContain("16mm");
    expect(result).toContain("C25/30");
    expect(result).toContain("S2");
    expect(result).toContain("50 vuotta");
  });

  it("formats betoni with flat selite properties", () => {
    const flat = {
      laatuNimike: "Lattiabetoni",
      raeKokoSelite: "16mm",
      lujuusSelite: "C25/30",
      notkeusSelite: "S2",
      kayttoIkaSelite: "50 vuotta",
    };
    const result = betoni_getString_noAttr(flat);
    expect(result).toContain("Lattiabetoni");
    expect(result).toContain("C25/30");
  });

  it("handles isNopea flag", () => {
    const nopea = { ...baseBetoni, isNopea: true };
    expect(betoni_getString_noAttr(nopea)).toContain("nopea");
  });

  it("handles string rasitusluokat", () => {
    const b = { ...baseBetoni, rasitusluokat: "XC1,XC3" };
    const result = betoni_getString_noAttr(b);
    expect(result).toContain("XC1");
    expect(result).toContain("XC3");
  });

  it("returns empty for null", () => {
    expect(betoni_getString_noAttr(null)).toBe("");
  });
});

// --- betoni_getString ---

describe("betoni_getString", () => {
  it("returns formatted string with attributes", () => {
    const result = betoni_getString(betoniWithAttrs);
    expect(result).toContain("Lattiabetoni");
    expect(result).toContain("Lisäaine1");
  });

  it("excludes attributes with noAttr=true", () => {
    const result = betoni_getString(betoniWithAttrs, true);
    expect(result).not.toContain("Lisäaine1");
  });

  it("handles array of betoni objects", () => {
    const result = betoni_getString([baseBetoni, baseBetoni]);
    expect(result).toContain(" + ");
  });

  it("uses comprehensive format when requested", () => {
    const result = betoni_getString(betoniWithVolume, false, true);
    expect(result).toContain("5m³");
    expect(result).toContain("Nopea");
  });

  it("returns empty for null", () => {
    expect(betoni_getString(null)).toBe("");
  });

  it("returns empty string for very short result (length <= 4)", () => {
    const minimal = { laatu: { laatuNimike: "AB" } };
    expect(betoni_getString(minimal)).toBe("");
  });
});

// --- betoni_getStrings ---

describe("betoni_getStrings", () => {
  it("returns array of string components", () => {
    const result = betoni_getStrings(betoniWithAttrs);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result).toContain("Huom tärkeä");
  });

  it("prepends Säänkestävä when weather resistant", () => {
    const wr = { ...baseBetoni, rasitusluokat: ["XF1"] };
    const result = betoni_getStrings(wr, { includeWeatherResistant: true });
    expect(result[0]).toContain("Säänkestävä");
  });

  it("returns null for null betoni", () => {
    expect(betoni_getStrings(null)).toBeNull();
  });
});

// --- betoni_getComprehensiveString ---

describe("betoni_getComprehensiveString", () => {
  it("includes volume, speed, weather resistance, and attrs", () => {
    const b = {
      ...betoniWithAttrs,
      m3: 3,
      isNopea: true,
      rasitusluokat: ["XF1", "XC3"],
    };
    const result = betoni_getComprehensiveString(b);
    expect(result).toContain("Säänkestävä");
    expect(result).toContain("3m³");
    expect(result).toContain("Nopea");
    expect(result).toContain("Lisäaine1");
    expect(result).toContain("Huom tärkeä");
  });

  it("returns empty for null", () => {
    expect(betoni_getComprehensiveString(null)).toBe("");
  });
});

// --- betoni_getComprehensiveString_noAttr ---

describe("betoni_getComprehensiveString_noAttr", () => {
  it("excludes attributes but includes volume", () => {
    const result = betoni_getComprehensiveString_noAttr(betoniWithVolume);
    expect(result).toContain("5m³");
    expect(result).toContain("Nopea");
  });

  it("excludes volume when excludeVolume=true", () => {
    const result = betoni_getComprehensiveString_noAttr(betoniWithVolume, true);
    expect(result).not.toContain("5m³");
  });

  it("returns empty for null", () => {
    expect(betoni_getComprehensiveString_noAttr(null)).toBe("");
  });
});

// --- betoni_isComplete ---

describe("betoni_isComplete", () => {
  it("returns complete for valid betoni", () => {
    expect(betoni_isComplete(baseBetoni)).toEqual({
      isComplete: true,
      reason: "",
    });
  });

  it("returns incomplete for null", () => {
    const result = betoni_isComplete(null);
    expect(result.isComplete).toBe(false);
    expect(result.reason).toContain("Betonia");
  });

  it("detects missing laatuId", () => {
    const b = { ...baseBetoni, laatuId: null, laatu: {} };
    expect(betoni_isComplete(b).reason).toContain("Laatua");
  });

  it("detects missing raeKokoId", () => {
    const b = { ...baseBetoni, raeKokoId: null, raeKoko: {} };
    expect(betoni_isComplete(b).reason).toContain("Raekokoa");
  });

  it("detects missing lujuusId", () => {
    const b = { ...baseBetoni, lujuusId: null, lujuus: {} };
    expect(betoni_isComplete(b).reason).toContain("Lujuutta");
  });

  it("detects missing notkeusId", () => {
    const b = { ...baseBetoni, notkeusId: null, notkeus: {} };
    expect(betoni_isComplete(b).reason).toContain("Notkeutta");
  });

  it("detects missing kayttoIkaId", () => {
    const b = { ...baseBetoni, kayttoIkaId: null, kayttoIka: {} };
    expect(betoni_isComplete(b).reason).toContain("Käyttöikää");
  });

  it("accepts nested IDs (laatu.laatuId)", () => {
    const b = {
      laatu: { laatuId: 1 },
      raeKoko: { raeKokoId: 1 },
      lujuus: { lujuusId: 1 },
      notkeus: { notkeusId: 1 },
      kayttoIka: { kayttoIkaId: 1 },
    };
    expect(betoni_isComplete(b).isComplete).toBe(true);
  });
});

// --- formatPersonName ---

describe("formatPersonName", () => {
  it("formats first and last name", () => {
    expect(formatPersonName("Matti", "Meikäläinen")).toBe("Matti Meikäläinen");
  });

  it("handles first name only", () => {
    expect(formatPersonName("Matti", null)).toBe("Matti");
  });

  it("handles last name only", () => {
    expect(formatPersonName(null, "Meikäläinen")).toBe("Meikäläinen");
  });

  it("returns fallback when both null", () => {
    expect(formatPersonName(null, null)).toBe("Nimetön");
  });

  it("uses custom fallback", () => {
    expect(formatPersonName(null, null, "Tuntematon")).toBe("Tuntematon");
  });

  it("handles undefined", () => {
    expect(formatPersonName(undefined, undefined)).toBe("Nimetön");
  });
});

// --- isEmail ---

describe("isEmail", () => {
  it("validates correct emails", () => {
    expect(isEmail("test@example.com")).toBe(true);
    expect(isEmail("user.name@domain.fi")).toBe(true);
    expect(isEmail("user+tag@example.co.uk")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isEmail("notanemail")).toBe(false);
    expect(isEmail("@domain.com")).toBe(false);
    expect(isEmail("user@")).toBe(false);
    expect(isEmail("")).toBe(false);
  });
});

// --- parseMultipleEmails ---

describe("parseMultipleEmails", () => {
  it("parses semicolon-separated emails", () => {
    const result = parseMultipleEmails("a@b.com; c@d.com");
    expect(result).toEqual(["a@b.com", "c@d.com"]);
  });

  it("filters invalid emails", () => {
    const result = parseMultipleEmails("a@b.com; invalid; c@d.com");
    expect(result).toEqual(["a@b.com", "c@d.com"]);
  });

  it("returns empty array for null/empty", () => {
    expect(parseMultipleEmails(null)).toEqual([]);
    expect(parseMultipleEmails("")).toEqual([]);
  });
});

// --- validateMultipleEmails ---

describe("validateMultipleEmails", () => {
  it("separates valid and invalid emails", () => {
    const result = validateMultipleEmails("a@b.com; invalid; c@d.com");
    expect(result.valid).toEqual(["a@b.com", "c@d.com"]);
    expect(result.invalid).toEqual(["invalid"]);
  });

  it("returns empty arrays for null", () => {
    expect(validateMultipleEmails(null)).toEqual({ valid: [], invalid: [] });
  });
});

// --- getText ---

describe("getText", () => {
  it("extracts _text from object", () => {
    expect(getText({ _text: "hello" })).toBe("hello");
  });

  it("returns null for missing _text", () => {
    expect(getText({})).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(getText(null)).toBeNull();
    expect(getText(undefined)).toBeNull();
  });

  it("returns falsy _text values", () => {
    expect(getText({ _text: "" })).toBe("");
    expect(getText({ _text: 0 })).toBe(0);
  });
});

// --- Constants ---

describe("constants", () => {
  it("RasitusLuokatArr has 18 entries", () => {
    expect(RasitusLuokatArr).toHaveLength(18);
    expect(RasitusLuokatArr).toContain("X0");
    expect(RasitusLuokatArr).toContain("XF1");
    expect(RasitusLuokatArr).toContain("XA3");
  });

  it("WEATHER_RESISTANT_CLASSES contains XF1 and XF3", () => {
    expect(WEATHER_RESISTANT_CLASSES).toEqual(["XF1", "XF3"]);
  });

  it("HAVERSINE_DISTANCE_M is a SQL string", () => {
    expect(typeof HAVERSINE_DISTANCE_M).toBe("string");
    expect(HAVERSINE_DISTANCE_M).toContain("6371000");
    expect(HAVERSINE_DISTANCE_M).toContain("ACOS");
  });
});

// --- escapeHtml ---

describe("escapeHtml", () => {
  it("escapes all 5 HTML special characters", () => {
    expect(escapeHtml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("returns empty string for null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("passes through safe strings unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("coerces non-string input to string", () => {
    expect(escapeHtml(123)).toBe("123");
    expect(escapeHtml(0)).toBe("0");
  });
});

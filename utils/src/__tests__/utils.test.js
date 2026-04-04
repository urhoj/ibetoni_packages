import { describe, it, expect } from "vitest";
import { escapeHtml } from "../htmlUtils.js";

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
    expect(escapeHtml(false)).toBe("false");
  });
});

import { describe, it, expect } from "vitest";
import { BETONIJERRY_CITIES } from "../betonijerry.js";

describe("BETONIJERRY_CITIES", () => {
  it("has 18 cities with unique slugs", () => {
    expect(BETONIJERRY_CITIES.length).toBe(18);
    const slugs = BETONIJERRY_CITIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(18);
  });

  it("every city has a kebab slug and finite Finnish coordinates", () => {
    for (const c of BETONIJERRY_CITIES) {
      expect(c.slug).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(c.name).toBeTruthy();
      expect(c.lat).toBeGreaterThan(59.5);
      expect(c.lat).toBeLessThan(70.5);
      expect(c.lng).toBeGreaterThan(20);
      expect(c.lng).toBeLessThan(32);
    }
  });

  it("is frozen so a consumer cannot mutate shared state", () => {
    expect(Object.isFrozen(BETONIJERRY_CITIES)).toBe(true);
  });
});

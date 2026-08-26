import { describe, it, expect } from "vitest";
import { appendUnique } from "../appendUnique.js";

const msg = (messageId, body = "x") => ({ messageId, body });

describe("appendUnique", () => {
  it("appends only messages whose messageId is not already present", () => {
    const prev = [msg(1), msg(2)];
    const result = appendUnique(prev, [msg(2), msg(3)]);
    expect(result.map((m) => m.messageId)).toEqual([1, 2, 3]);
  });

  it("poll re-returning the bookmark message does not grow the thread", () => {
    // The DATETIME2(7) vs millisecond-bookmark mismatch makes ?since= re-return
    // the last message on EVERY poll — the exact bug this dedupe exists for.
    const prev = [msg(1), msg(2)];
    const result = appendUnique(prev, [msg(2)]);
    expect(result).toBe(prev); // same reference → setState no-op
  });

  it("returns the same reference when incoming is empty", () => {
    const prev = [msg(1)];
    expect(appendUnique(prev, [])).toBe(prev);
  });

  it("appends to an empty thread", () => {
    expect(appendUnique([], [msg(1)])).toEqual([msg(1)]);
  });

  it("dedupes within a single incoming batch against prev only once each", () => {
    const prev = [msg(1)];
    const result = appendUnique(prev, [msg(1), msg(2), msg(3)]);
    expect(result.map((m) => m.messageId)).toEqual([1, 2, 3]);
  });
});

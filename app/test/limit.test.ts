import { expect, it } from "vitest";
import { createLimiter } from "../lib/limit";

it("limits each key per window, then resets", () => {
  let t = 0;
  const allow = createLimiter(2, 100, () => t);
  expect([allow("a"), allow("a"), allow("a")]).toEqual([true, true, false]);
  expect(allow("b")).toBe(true);
  t = 100;
  expect(allow("a")).toBe(true);
});

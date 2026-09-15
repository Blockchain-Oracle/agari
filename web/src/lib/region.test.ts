import { afterEach, describe, expect, it } from "vitest";
import { readRegionRestricted } from "./region";

const setCookie = (cookie: string) => Object.defineProperty(globalThis, "document", { value: { cookie }, configurable: true });

afterEach(() => Reflect.deleteProperty(globalThis, "document"));

describe("readRegionRestricted", () => {
  it("is open with no document at all", () => expect(readRegionRestricted()).toBe(false));

  it("finds the mark beside other cookies", () => {
    setCookie("agari_theme=light; agari.region=restricted; x_session=abc");
    expect(readRegionRestricted()).toBe(true);
  });

  it("does not match a cookie whose name merely ends the same way", () => {
    setCookie("not-agari.region=restricted");
    expect(readRegionRestricted()).toBe(false);
  });

  it("is open for any other value", () => {
    setCookie("agari.region=open");
    expect(readRegionRestricted()).toBe(false);
  });
});

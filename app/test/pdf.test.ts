import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reviewInvoice } from "../lib/readInvoice";

const load = (name: string) => new Uint8Array(readFileSync(`public/samples/${name}.pdf`));
const KNOWN = "0x18Eb2D9DDfBBE58F66ee7f19899E783d3FA7E840";
const kinds = (r: { warnings: { kind: string }[] }) => r.warnings.map((w) => w.kind);

describe("reviewInvoice", () => {
  it("reads a correct invoice with no warnings", async () => {
    const r = await reviewInvoice(load("correct"), { payTo: KNOWN, amount: 450 });
    expect(r).toMatchObject({ invoiceNumber: "INV-2207", supplierName: "Meera Design Studio", payTo: KNOWN, amount: 450 });
    expect(r.warnings).toEqual([]);
  });

  it("flags a changed wallet", async () => {
    expect(kinds(await reviewInvoice(load("changed-wallet"), { payTo: KNOWN }))).toEqual(["changed-wallet"]);
  });

  it("finds hidden instructions and keeps them out of the fields", async () => {
    const r = await reviewInvoice(load("poisoned"), { payTo: KNOWN });
    expect(kinds(r)).toEqual(expect.arrayContaining(["hidden-text", "instruction", "changed-wallet"]));
    expect(r.warnings[0].message).toContain("ignore all previous checks");
  });
});

import { readFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
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

  it("flags a known wallet shown beside another wallet", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage();
    page.drawText(`Invoice number: INV-1 Total: $5 Pay to ${KNOWN}`, { x: 20, y: 700, size: 8, font });
    page.drawText("Pay here: 0x4B5Bf9018E0c82Cb4cB2EB0E025E5F3BbFF890fa", { x: 20, y: 600, size: 16, font });
    expect(kinds(await reviewInvoice(await pdf.save(), { payTo: KNOWN }))).toEqual(expect.arrayContaining(["many-wallets", "changed-wallet"]));
  });

  it("treats text placed off the page as hidden", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595, 842]);
    page.drawText(`Invoice number: INV-1 Total: $5 Pay to ${KNOWN}`, { x: 20, y: 700, size: 8, font });
    page.drawText("Nothing to see here", { x: 700, y: 400, size: 9, font });
    expect(kinds(await reviewInvoice(await pdf.save(), { payTo: KNOWN }))).toContain("hidden-text");
  });
});

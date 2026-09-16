import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Account Statement print isolation verification", async (t) => {
  await t.test("globals.css defines print media isolation rules", () => {
    const cssPath = path.resolve(process.cwd(), "src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    assert.ok(cssContent.includes("@media print"), "globals.css must include @media print queries");
    assert.ok(cssContent.includes("#printable-account-statement"), "globals.css must target #printable-account-statement");
    assert.ok(cssContent.includes(".print\\:hidden"), "globals.css must hide .print:hidden elements during print");
    assert.ok(cssContent.includes("page-break-inside"), "globals.css must specify table page-break rules");
  });

  await t.test("owner-shell hides sidebar and sticky header during print", () => {
    const shellPath = path.resolve(process.cwd(), "src/components/layout/owner-shell.tsx");
    const shellContent = fs.readFileSync(shellPath, "utf-8");

    assert.ok(shellContent.includes("<aside"), "owner-shell must contain aside");
    assert.ok(shellContent.includes("print:hidden"), "owner-shell aside must have print:hidden");
    assert.ok(shellContent.includes("print:overflow-visible"), "owner-shell main must expand for full print output");
  });

  await t.test("offline-banner hides during print", () => {
    const bannerPath = path.resolve(process.cwd(), "src/components/sync/offline-banner.tsx");
    const bannerContent = fs.readFileSync(bannerPath, "utf-8");

    assert.ok(bannerContent.includes("print:hidden"), "offline-banner must include print:hidden");
  });

  await t.test("udhaar page isolates account statement and non-printable sections", () => {
    const udhaarPath = path.resolve(process.cwd(), "src/app/(owner)/udhaar/page.tsx");
    const udhaarContent = fs.readFileSync(udhaarPath, "utf-8");

    assert.ok(udhaarContent.includes("udhaar-non-printable"), "udhaar page must wrap background content in udhaar-non-printable");
    assert.ok(udhaarContent.includes('id="printable-account-statement"'), "udhaar page must identify #printable-account-statement");
    assert.ok(udhaarContent.includes("Customer Account Statement"), "udhaar page must provide formal print statement header");
    assert.ok(udhaarContent.includes("handlePrintStatement"), "udhaar page must wire print handler");
    assert.ok(udhaarContent.includes("Period Total Debits"), "udhaar page must display financial summary totals in statement");
    assert.ok(udhaarContent.includes("Period Total Credits"), "udhaar page must calculate period credits/payments");
    assert.ok(udhaarContent.includes("Customer Signature"), "udhaar page must provide acknowledgement / signature block on printed document");
  });
});

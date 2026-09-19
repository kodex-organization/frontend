import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Record Payment Modal and Service Card Concession Integration", async (t) => {
  const modalPath = path.resolve(
    process.cwd(),
    "src/features/invoice/components/RecordPaymentModal.tsx"
  );
  const modalContent = fs.readFileSync(modalPath, "utf-8");

  const invoiceDetailsPath = path.resolve(
    process.cwd(),
    "src/features/invoice/components/InvoiceDetails.tsx"
  );
  const invoiceDetailsContent = fs.readFileSync(invoiceDetailsPath, "utf-8");

  const invoiceServicePath = path.resolve(
    process.cwd(),
    "src/features/invoice/services/invoiceService.ts"
  );
  const invoiceServiceContent = fs.readFileSync(invoiceServicePath, "utf-8");

  await t.test("RecordPaymentModal accepts cardTotal and standardTotal props", () => {
    assert.ok(
      modalContent.includes("standardTotal?: number"),
      "RecordPaymentModal must accept standardTotal prop"
    );
    assert.ok(
      modalContent.includes("cardTotal?: number"),
      "RecordPaymentModal must accept cardTotal prop"
    );
  });

  await t.test("RecordPaymentModal auto-adjusts amount and displays PRA 5% Card Tax Concession banner", () => {
    assert.ok(
      modalContent.includes("PRA 5% Card Tax Concession"),
      "RecordPaymentModal must display PRA 5% Card Tax Concession badge"
    );
    assert.ok(
      modalContent.includes("handleTenderTypeChange"),
      "RecordPaymentModal must handle tender type changes"
    );
    assert.ok(
      modalContent.includes("cardTotal.toFixed(2)"),
      "RecordPaymentModal must auto-adjust amount to cardTotal when card is selected"
    );
  });

  await t.test("InvoiceDetails passes cardTotal and standardTotal to RecordPaymentModal and triggers refresh", () => {
    assert.ok(
      invoiceDetailsContent.includes("standardTotal={standardTotal}"),
      "InvoiceDetails must pass standardTotal to RecordPaymentModal"
    );
    assert.ok(
      invoiceDetailsContent.includes("cardTotal={cardTotal}"),
      "InvoiceDetails must pass cardTotal to RecordPaymentModal"
    );
    assert.ok(
      invoiceDetailsContent.includes("void refresh()"),
      "InvoiceDetails must trigger refresh upon recording payment"
    );
  });

  await t.test("invoiceService.addPayment sends tenders array in request payload", () => {
    assert.ok(
      invoiceServiceContent.includes("tenders: ["),
      "invoiceService.addPayment must include tenders array in payload"
    );
    assert.ok(
      invoiceServiceContent.includes("tenderType: input.tenderType"),
      "invoiceService.addPayment must map input.tenderType into tenders array"
    );
    assert.ok(
      invoiceServiceContent.includes("amount: input.amount"),
      "invoiceService.addPayment must map input.amount into tenders array"
    );
  });
});

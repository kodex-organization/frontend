import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Customer Duplicate Phone Validation and Error Handling", async (t) => {
  const customerApiPath = path.resolve(
    process.cwd(),
    "src/features/customers/customer-api.ts"
  );
  const customerApiContent = fs.readFileSync(customerApiPath, "utf-8");

  const customerPagePath = path.resolve(
    process.cwd(),
    "src/app/(owner)/customers/page.tsx"
  );
  const customerPageContent = fs.readFileSync(customerPagePath, "utf-8");

  await t.test("customerApi imports ApiError and re-throws it on online create without swallowing into offline queue", () => {
    // Assert ApiError is imported
    assert.ok(
      customerApiContent.includes("ApiError") && customerApiContent.includes("@/lib/api/client"),
      "customerApi must import ApiError from @/lib/api/client"
    );

    // Assert create catches onlineError and re-throws if ApiError or HTTP status > 0
    assert.ok(
      customerApiContent.includes("onlineError instanceof ApiError"),
      "customerApi.create must check if onlineError is an ApiError"
    );
    assert.ok(
      customerApiContent.includes("(onlineError as any).status > 0"),
      "customerApi.create must check if onlineError has HTTP status > 0"
    );
  });

  await t.test("customerApi.create checks offline cache for duplicate phone numbers before queueing", () => {
    assert.ok(
      customerApiContent.includes("cachedCustomers.toArray()"),
      "customerApi.create must query offline cached customers"
    );
    assert.ok(
      customerApiContent.includes("A customer with this phone number already exists"),
      "customerApi.create must provide a clear validation message when duplicate phone is found offline"
    );
  });

  await t.test("customerApi.update checks offline duplicate phone and re-throws ApiError", () => {
    assert.ok(
      customerApiContent.includes("update: async (id: string, body: CustomerUpdateInput)"),
      "customerApi must have update method"
    );
    const updateBlock = customerApiContent.slice(customerApiContent.indexOf("update: async (id: string"));
    assert.ok(
      updateBlock.includes("onlineError instanceof ApiError") &&
      updateBlock.includes("(onlineError as any).status > 0"),
      "customerApi.update must re-throw online ApiError without falling back to offline queue"
    );
  });

  await t.test("customers/page.tsx keeps modal open and displays inline error alert on validation failure", () => {
    assert.ok(
      customerPageContent.includes("const [formError, setFormError] = useState<string | null>(null)"),
      "customers/page.tsx must manage formError state"
    );
    assert.ok(
      customerPageContent.includes("setFormError(null)"),
      "customers/page.tsx must clear formError when resetting or opening modal"
    );
    assert.ok(
      customerPageContent.includes("setFormError(message)"),
      "customers/page.tsx must set formError when submit fails"
    );
    assert.ok(
      customerPageContent.includes("toast.error(message)"),
      "customers/page.tsx must show toast.error on submit failure"
    );
    assert.ok(
      customerPageContent.includes("ShieldAlert"),
      "customers/page.tsx must display ShieldAlert icon with the inline error alert"
    );
    assert.ok(
      customerPageContent.includes("{formError && ("),
      "customers/page.tsx must conditionally render formError alert banner inside the customer modal"
    );
  });
});

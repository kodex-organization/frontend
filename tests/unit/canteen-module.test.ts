import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Canteen module navigation and functionality", async (t) => {
  const shellPath = path.resolve(
    process.cwd(),
    "src/components/layout/owner-shell.tsx"
  );
  const shellContent = fs.readFileSync(shellPath, "utf-8");

  const canteenPagePath = path.resolve(
    process.cwd(),
    "src/app/(owner)/canteen/page.tsx"
  );
  const canteenPageContent = fs.readFileSync(canteenPagePath, "utf-8");

  const menuManagerPath = path.resolve(
    process.cwd(),
    "src/features/canteen/components/MenuManager.tsx"
  );
  const menuManagerContent = fs.readFileSync(menuManagerPath, "utf-8");

  const posScreenPath = path.resolve(
    process.cwd(),
    "src/features/canteen/components/PosScreen.tsx"
  );
  const posScreenContent = fs.readFileSync(posScreenPath, "utf-8");

  await t.test("Owner shell includes Canteen navigation", () => {
    assert.ok(
      shellContent.includes("canOperateCanteen"),
      "Owner shell must check canOperateCanteen role"
    );
    assert.ok(
      shellContent.includes('href: "/canteen"'),
      "Owner shell must have link to /canteen"
    );
    assert.ok(
      shellContent.includes("UtensilsCrossed"),
      "Owner shell must use UtensilsCrossed icon"
    );
  });

  await t.test("Canteen page exposes Point of Sale and Menu tabs", () => {
    assert.ok(
      canteenPageContent.includes("PosScreen"),
      "Canteen page must render PosScreen component"
    );
    assert.ok(
      canteenPageContent.includes("MenuManager"),
      "Canteen page must render MenuManager component"
    );
    assert.ok(
      canteenPageContent.includes("Point of Sale"),
      "Canteen page must include Point of Sale tab"
    );
    assert.ok(
      canteenPageContent.includes("Menu & Products"),
      "Canteen page must include Menu & Products tab"
    );
  });

  await t.test("MenuManager supports full category and product CRUD", () => {
    assert.ok(
      menuManagerContent.includes("handleSaveCategory"),
      "MenuManager must support saving categories"
    );
    assert.ok(
      menuManagerContent.includes("handleDeleteCategory"),
      "MenuManager must support deleting categories"
    );
    assert.ok(
      menuManagerContent.includes("handleSaveItem"),
      "MenuManager must support saving menu items"
    );
    assert.ok(
      menuManagerContent.includes("handleDeleteItem"),
      "MenuManager must support deleting menu items"
    );
    assert.ok(
      menuManagerContent.includes("handleToggleStock"),
      "MenuManager must support toggling product stock availability"
    );
    assert.ok(
      menuManagerContent.includes("searchQuery"),
      "MenuManager must support searching products"
    );
    assert.ok(
      menuManagerContent.includes("selectedCategory"),
      "MenuManager must support filtering by category"
    );
  });

  await t.test("PosScreen supports table session assignment and direct orders", () => {
    assert.ok(
      posScreenContent.includes("sessionApi.active"),
      "PosScreen must load active sessions"
    );
    assert.ok(
      posScreenContent.includes("destinationMode"),
      "PosScreen must support switching destination between walk-in and session"
    );
    assert.ok(
      posScreenContent.includes("CanteenApi.addItemsToSession"),
      "PosScreen must support issuing items to table session"
    );
    assert.ok(
      posScreenContent.includes("CanteenApi.createStandaloneOrder"),
      "PosScreen must support standalone walk-in orders"
    );
    assert.ok(
      posScreenContent.includes("handleBarcodeScanned"),
      "PosScreen must support barcode scanner lookup"
    );
  });
});

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CanteenApi, Category, MenuItem } from "../canteen.api";
import {
  Loader2,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  Search,
  CheckCircle2,
  XCircle,
  Tag,
  Package,
  Layers,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { useBranchCurrency } from "@/features/tenancy/useBranchCurrency";
import { formatCurrency } from "@/features/invoice/utils/formatCurrency";

interface CategoryFormData {
  name: string;
  isActive: boolean;
}

interface MenuItemFormData {
  name: string;
  categoryId: string;
  currentPrice: string;
  barcode: string;
  description: string;
  isActive: boolean;
}

export function MenuManager() {
  const { user } = useAuth();
  const currency = useBranchCurrency();
  const isOnline = useOnlineStatus();
  const isManagement = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER"
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Category Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: "",
    isActive: true,
  });
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Menu Item Modal State
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<MenuItemFormData>({
    name: "",
    categoryId: "",
    currentPrice: "",
    barcode: "",
    description: "",
    isActive: true,
  });
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [cats, itms] = await Promise.all([
        CanteenApi.getCategories(),
        CanteenApi.getMenuItems(),
      ]);
      setCategories(cats);
      setItems(itms);
    } catch (err: any) {
      console.warn("Failed to load menu data from server, falling back to local cache:", err);
      try {
        const [cats, itms] = await Promise.all([
          CanteenApi.getCategories(),
          CanteenApi.getMenuItems(),
        ]);
        setCategories(cats);
        setItems(itms);
      } catch (fallbackErr: any) {
        setError(fallbackErr.message || "Failed to load menu data");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleSyncUpdate = () => {
      loadData();
    };
    window.addEventListener("cuecloud:offline-queue-changed", handleSyncUpdate);
    window.addEventListener("online", handleSyncUpdate);
    return () => {
      window.removeEventListener("cuecloud:offline-queue-changed", handleSyncUpdate);
      window.removeEventListener("online", handleSyncUpdate);
    };
  }, []);

  // --- Category Actions ---
  const handleOpenCategoryModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryForm({
        name: cat.name,
        isActive: cat.isActive,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: "",
        isActive: true,
      });
    }
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      setIsSubmittingCategory(true);
      if (editingCategory) {
        const updated = await CanteenApi.updateCategory(editingCategory.id, {
          name: categoryForm.name.trim(),
          isActive: categoryForm.isActive,
        });
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        toast.success(`Category "${updated.name}" updated successfully`);
      } else {
        const created = await CanteenApi.createCategory({
          name: categoryForm.name.trim(),
          isActive: categoryForm.isActive,
        });
        setCategories((prev) => [...prev, created]);
        toast.success(`Category "${created.name}" created successfully`);
      }
      setCategoryModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save category");
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      setIsDeletingCategory(true);
      await CanteenApi.deleteCategory(categoryToDelete.id);
      setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id));
      if (selectedCategory === categoryToDelete.id) {
        setSelectedCategory(null);
      }
      toast.success(`Category "${categoryToDelete.name}" deleted`);
      setCategoryToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete category");
    } finally {
      setIsDeletingCategory(false);
    }
  };

  // --- Menu Item Actions ---
  const handleOpenItemModal = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        name: item.name,
        categoryId: item.categoryId || "",
        currentPrice: String(item.currentPrice),
        barcode: item.barcode || "",
        description: item.description || "",
        isActive: item.isActive,
      });
    } else {
      setEditingItem(null);
      setItemForm({
        name: "",
        categoryId: selectedCategory || (categories[0]?.id ?? ""),
        currentPrice: "",
        barcode: "",
        description: "",
        isActive: true,
      });
    }
    setItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    const priceNum = parseFloat(itemForm.currentPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a valid non-negative price");
      return;
    }

    try {
      setIsSubmittingItem(true);
      const payload = {
        name: itemForm.name.trim(),
        categoryId: itemForm.categoryId ? itemForm.categoryId : undefined,
        currentPrice: priceNum,
        barcode: itemForm.barcode.trim() || undefined,
        description: itemForm.description.trim() || undefined,
        isActive: itemForm.isActive,
      };

      if (editingItem) {
        const updated = await CanteenApi.updateMenuItem(editingItem.id, payload);
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        toast.success(`Item "${updated.name}" updated successfully`);
      } else {
        const created = await CanteenApi.createMenuItem(payload);
        setItems((prev) => [...prev, created]);
        toast.success(`Item "${created.name}" created successfully`);
      }
      setItemModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save menu item");
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeletingItem(true);
      await CanteenApi.deleteMenuItem(itemToDelete.id);
      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      toast.success(`Item "${itemToDelete.name}" removed from catalog`);
      setItemToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete item");
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleToggleStock = async (item: MenuItem) => {
    try {
      const updated = await CanteenApi.toggleItemAvailability(
        item.id,
        !item.isAvailable
      );
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, isAvailable: updated.isAvailable } : i
        )
      );
      toast.success(
        `${item.name} marked as ${
          updated.isAvailable ? "In Stock" : "Out of Stock"
        }`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update stock availability");
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === null || item.categoryId === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.barcode &&
          item.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.description &&
          item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <p className="text-sm text-slate-500">Loading Canteen Menu Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4 text-rose-600">
        <AlertCircle className="h-10 w-10" />
        <p className="text-lg font-semibold text-slate-900">Error Loading Data</p>
        <p className="text-sm text-slate-500">{error}</p>
        <Button onClick={loadData} variant="secondary" className="w-auto">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isOnline && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Offline Mode — Products and catalog changes are saved locally and queued for synchronization.</span>
          </div>
          <span className="text-amber-800 font-bold px-2 py-0.5 rounded bg-amber-100 border border-amber-200">Local Catalog</span>
        </div>
      )}
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Canteen Products &amp; Catalog
          </h2>
          <p className="text-sm text-slate-500">
            Manage food, beverages, snacks, and retail items sold in the canteen.
          </p>
        </div>
        {isManagement && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenCategoryModal()}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Category
            </Button>
            <Button
              onClick={() => handleOpenItemModal()}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* LEFT COLUMN: Categories Sidebar */}
        <div className="md:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Categories
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {categories.length}
            </span>
          </div>

          <div className="space-y-1">
            {/* All Items Filter Button */}
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition text-left ${
                selectedCategory === null
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4" /> All Products
              </span>
              <span className="text-xs font-mono opacity-80">{items.length}</span>
            </button>

            {/* Individual Categories */}
            {categories.map((c) => {
              const count = items.filter((i) => i.categoryId === c.id).length;
              const isSelected = selectedCategory === c.id;

              return (
                <div
                  key={c.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl text-sm transition ${
                    isSelected
                      ? "bg-brand-600 text-white font-medium shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className="flex-1 text-left flex items-center gap-2 truncate"
                  >
                    <Tag className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{c.name}</span>
                    {!c.isActive && (
                      <span className="text-[10px] uppercase tracking-wider bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold">
                        Inactive
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono opacity-70 px-1">
                      {count}
                    </span>
                    {isManagement && (
                      <div className="hidden group-hover:flex items-center gap-0.5 pl-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCategoryModal(c);
                          }}
                          className={`p-1 rounded hover:bg-slate-200 ${
                            isSelected ? "text-white" : "text-slate-500"
                          }`}
                          title="Edit Category"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategoryToDelete(c);
                          }}
                          className={`p-1 rounded hover:bg-rose-500 hover:text-white ${
                            isSelected ? "text-white" : "text-rose-600"
                          }`}
                          title="Delete Category"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {categories.length === 0 && (
            <div className="p-4 text-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
              No categories created yet.
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Products Grid & Search */}
        <div className="md:col-span-3 space-y-4">
          {/* Search bar & count summary */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search products by name, barcode, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-white border-slate-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xs text-slate-500 self-center shrink-0">
              Showing <span className="font-bold text-slate-900">{filteredItems.length}</span> of{" "}
              <span className="font-bold text-slate-900">{items.length}</span> products
            </div>
          </div>

          {/* Empty filtered items */}
          {filteredItems.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3 bg-slate-50">
              <Package className="w-10 h-10 text-slate-300" />
              <div>
                <p className="font-semibold text-slate-700">
                  No products found
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {searchQuery
                    ? "Try adjusting your search query or clear the filter."
                    : "No products exist under this category yet."}
                </p>
              </div>
              {isManagement && (
                <Button
                  onClick={() => handleOpenItemModal()}
                  size="sm"
                  className="mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Product Now
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const categoryName =
                  categories.find((c) => c.id === item.categoryId)?.name ||
                  "General";

                return (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-150"
                  >
                    <div>
                      {/* Top status & category badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 truncate max-w-[120px]">
                          {categoryName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleStock(item)}
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition flex items-center gap-1 ${
                            item.isAvailable
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                          }`}
                          title="Click to toggle availability"
                        >
                          {item.isAvailable ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> In Stock
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Out of Stock
                            </>
                          )}
                        </button>
                      </div>

                      {/* Product Name & Description */}
                      <h4 className="font-bold text-slate-900 text-base leading-snug">
                        {item.name}
                      </h4>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* Barcode if present */}
                      {item.barcode && (
                        <div className="mt-2 text-[11px] font-mono text-slate-500 flex items-center gap-1">
                          <span className="uppercase text-[9px] font-bold bg-slate-100 px-1 rounded">
                            UPC
                          </span>{" "}
                          {item.barcode}
                        </div>
                      )}
                    </div>

                    {/* Bottom Price & Controls */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 block">
                          Price
                        </span>
                        <span className="font-extrabold text-lg text-brand-700 font-mono">
                          {formatCurrency(Number(item.currentPrice), currency)}
                        </span>
                      </div>

                      {isManagement && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleOpenItemModal(item)}
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => setItemToDelete(item)}
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL: Add / Edit Category --- */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </h3>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Category Name *
                </label>
                <Input
                  required
                  placeholder="e.g. Beverages, Hot Food, Snacks"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="categoryActive"
                  checked={categoryForm.isActive}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <label
                  htmlFor="categoryActive"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  Active in menu
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCategoryModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingCategory || !categoryForm.name.trim()}
                >
                  {isSubmittingCategory ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{" "}
                      Saving...
                    </>
                  ) : editingCategory ? (
                    "Update Category"
                  ) : (
                    "Create Category"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Add / Edit Product --- */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? "Edit Canteen Product" : "Add New Canteen Product"}
              </h3>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Product Name *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Mineral Water 500ml, Chicken Sandwich"
                    value={itemForm.name}
                    onChange={(e) =>
                      setItemForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Category
                  </label>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) =>
                      setItemForm((prev) => ({
                        ...prev,
                        categoryId: e.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all"
                  >
                    <option value="">-- None / General --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Price ({currency}) *
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="e.g. 150.00"
                    value={itemForm.currentPrice}
                    onChange={(e) =>
                      setItemForm((prev) => ({
                        ...prev,
                        currentPrice: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Barcode / SKU (Optional)
                  </label>
                  <Input
                    placeholder="Scan or type barcode for instant POS lookup"
                    value={itemForm.barcode}
                    onChange={(e) =>
                      setItemForm((prev) => ({
                        ...prev,
                        barcode: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Product details, ingredients, or sizing..."
                    value={itemForm.description}
                    onChange={(e) =>
                      setItemForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-all resize-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="itemActive"
                  checked={itemForm.isActive}
                  onChange={(e) =>
                    setItemForm((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <label
                  htmlFor="itemActive"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  Active in catalog
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setItemModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmittingItem ||
                    !itemForm.name.trim() ||
                    !itemForm.currentPrice
                  }
                >
                  {isSubmittingItem ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{" "}
                      Saving...
                    </>
                  ) : editingItem ? (
                    "Update Product"
                  ) : (
                    "Create Product"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Category */}
      <ConfirmModal
        isOpen={Boolean(categoryToDelete)}
        title="Delete Category"
        description={`Are you sure you want to delete category "${categoryToDelete?.name}"? Items in this category will not be deleted, but will become uncategorized.`}
        confirmText="Delete Category"
        variant="danger"
        isLoading={isDeletingCategory}
        onConfirm={handleDeleteCategory}
        onCancel={() => setCategoryToDelete(null)}
      />

      {/* Confirmation Modal for Delete Menu Item */}
      <ConfirmModal
        isOpen={Boolean(itemToDelete)}
        title="Delete Canteen Product"
        description={`Are you sure you want to delete "${itemToDelete?.name}" from the canteen menu?`}
        confirmText="Delete Product"
        variant="danger"
        isLoading={isDeletingItem}
        onConfirm={handleDeleteItem}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { CanteenApi, Category, MenuItem } from "../canteen.api";
import { Loader2, Plus, Trash, Edit, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";

import { ConfirmModal } from "@/components/ui/ConfirmModal";

export function MenuManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  useEffect(() => {
    loadData();
  }, []);

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
      setError(err.message || "Failed to load menu data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    toast.success(`Item "${itemToDelete.name}" removed from catalog.`);
    setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
    setItemToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading Menu Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4 text-destructive">
        <AlertCircle className="h-10 w-10" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p>{error}</p>
        <Button onClick={loadData} variant="secondary" className="w-auto">Try Again</Button>
      </div>
    );
  }

  if (categories.length === 0 && items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">No menu items or categories found.</p>
        <Button onClick={() => toast.info("Please create categories from the catalog settings.")} className="w-auto"><Plus className="w-4 h-4 mr-2" /> Add Category</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Canteen Menu</h2>
        <div className="flex gap-2">
           <Button variant="secondary" className="w-auto" onClick={() => toast.info("Use Catalog Settings to create categories.")}><Plus className="w-4 h-4 mr-2" /> Category</Button>
           <Button className="w-auto" onClick={() => toast.info("Use Catalog Settings to add items.")}><Plus className="w-4 h-4 mr-2" /> Menu Item</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold">Categories</h3>
          <ul className="space-y-2">
            <li className="p-3 bg-secondary rounded-md font-medium cursor-pointer">All Items</li>
            {categories.map((c) => (
              <li key={c.id} className="p-3 border rounded-md hover:bg-muted cursor-pointer flex justify-between group">
                {c.name}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="md:col-span-3 space-y-4">
          <h3 className="text-lg font-semibold">Items</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const handleToggleStock = async () => {
                try {
                  await CanteenApi.toggleItemAvailability(item.id, !item.isAvailable);
                  toast.success(`${item.name} is now ${!item.isAvailable ? "available" : "out of stock"}`);
                  loadData();
                } catch (err: any) {
                  toast.error(err.message || "Failed to update item availability");
                }
              };

              return (
                <div key={item.id} className="border rounded-lg p-4 flex flex-col justify-between bg-card">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-semibold text-lg">{item.name}</h4>
                      <button
                        onClick={handleToggleStock}
                        className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                          item.isAvailable
                            ? "bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100"
                            : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        {item.isAvailable ? "In Stock" : "Out of Stock"}
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    <p className="font-medium mt-2 text-primary">${Number(item.currentPrice).toFixed(2)}</p>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" className="w-9 h-9 p-0" onClick={() => toast.info(`Editing ${item.name}`)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" className="text-destructive w-9 h-9 p-0" onClick={() => setItemToDelete(item)}><Trash className="w-4 h-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(itemToDelete)}
        title="Delete Menu Item"
        description={`Are you sure you want to remove "${itemToDelete?.name}" from the canteen menu?`}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CanteenApi, Category, MenuItem, Order } from "../canteen.api";
import { Loader2, AlertCircle, ShoppingCart, Search, Plus, Minus, Trash, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";

interface CartItem extends MenuItem {
  cartQuantity: number;
  cartNotes?: string;
}

export function PosScreen({ sessionId }: { sessionId?: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Barcode scanner logic
  const [barcodeBuffer, setBarcodeBuffer] = useState("");

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [cats, itms] = await Promise.all([
        CanteenApi.getCategories(),
        CanteenApi.getMenuItems(),
      ]);
      setCategories(cats.filter(c => c.isActive));
      setItems(itms.filter(i => i.isActive));
    } catch (err: any) {
      setError(err.message || "Failed to load POS data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // HID Barcode Scanner Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Enter") {
        if (barcodeBuffer.length > 0) {
          handleBarcodeScanned(barcodeBuffer);
          setBarcodeBuffer("");
        }
      } else if (e.key.length === 1) {
        setBarcodeBuffer((prev) => prev + e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [barcodeBuffer, items]);

  const handleBarcodeScanned = useCallback((scannedBarcode: string) => {
    const matchedItem = items.find((i) => i.barcode === scannedBarcode);
    if (matchedItem) {
      addToCart(matchedItem);
      toast.success(`Scanned: ${matchedItem.name}`);
    } else {
      toast.error(`Barcode not found: ${scannedBarcode}`);
    }
  }, [items]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => i.id === item.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i);
      }
      return [...prev, { ...item, cartQuantity: 1, cartNotes: "" }];
    });
  };

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      setIsSubmitting(true);
      const payload = cart.map((c) => ({
        menuItemId: c.id,
        quantity: c.cartQuantity,
        notes: c.cartNotes || undefined,
      }));

      if (sessionId) {
        await CanteenApi.addItemsToSession(sessionId, payload);
        toast.success("Items added to table session successfully!");
      } else {
        await CanteenApi.createStandaloneOrder(payload);
        toast.success("Standalone order processed successfully!");
      }
      setCart([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to process order");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading POS...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4 text-destructive">
        <AlertCircle className="h-10 w-10" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p>{error}</p>
        <Button onClick={loadData} variant="outline">Try Again</Button>
      </div>
    );
  }

  const filteredItems = activeCategory ? items.filter(i => i.categoryId === activeCategory) : items;
  const cartTotal = cart.reduce((sum, item) => sum + (Number(item.currentPrice) * item.cartQuantity), 0);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[80vh] gap-6">
      {/* LEFT: Menu Selection */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button 
            variant={activeCategory === null ? "default" : "outline"} 
            onClick={() => setActiveCategory(null)}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button 
              key={c.id} 
              variant={activeCategory === c.id ? "default" : "outline"}
              onClick={() => setActiveCategory(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground bg-secondary/20 rounded-lg border border-dashed">
            No items found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto">
            {filteredItems.map((item) => (
              <div 
                key={item.id} 
                onClick={() => addToCart(item)}
                className="border rounded-xl p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors flex flex-col justify-between aspect-square"
              >
                <div>
                  <h4 className="font-semibold line-clamp-2">{item.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                </div>
                <div className="font-bold text-lg text-primary mt-2">
                  ${Number(item.currentPrice).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: Cart / Order Panel */}
      <div className="w-full lg:w-96 flex flex-col border rounded-xl bg-card overflow-hidden">
        <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">
              {sessionId ? "Add to Session" : "New Order"}
            </h3>
          </div>
          <span className="text-xs font-mono bg-background px-2 py-1 rounded border text-muted-foreground">
            SCAN READY
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
              <p>Cart is empty</p>
              <p className="text-xs mt-2 opacity-50">Scan a barcode or tap an item</p>
            </div>
          ) : (
            cart.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 p-3 border rounded-lg bg-background shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="font-medium">{c.name}</div>
                  <div className="font-semibold">${(Number(c.currentPrice) * c.cartQuantity).toFixed(2)}</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={() => c.cartQuantity > 1 ? updateCartItem(c.id, { cartQuantity: c.cartQuantity - 1 }) : removeFromCart(c.id)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{c.cartQuantity}</span>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => updateCartItem(c.id, { cartQuantity: c.cartQuantity + 1 })}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(c.id)}>
                    <Trash className="w-3 h-3" />
                  </Button>
                </div>
                
                <div className="relative mt-1">
                  <FileText className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                  <Input 
                    placeholder="Add note (e.g. no sugar)" 
                    className="h-7 text-xs pl-7" 
                    value={c.cartNotes}
                    onChange={(e) => updateCartItem(c.id, { cartNotes: e.target.value })}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t bg-muted/50 space-y-4">
          <div className="flex justify-between items-center font-bold text-xl">
            <span>Total:</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
          <Button 
            className="w-full h-12 text-lg" 
            size="lg" 
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleCheckout}
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {sessionId ? "Send to Table" : "Complete Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CanteenApi, Category, MenuItem } from "../canteen.api";
import {
  Loader2,
  AlertCircle,
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  FileText,
  ScanBarcode,
  CheckCircle2,
  X,
  Armchair,
  User,
  Coffee,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";
import { sessionApi } from "@/features/sessions/session-api";
import type { ActiveSession } from "@/features/sessions/types";
import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";

interface CartItem extends MenuItem {
  cartQuantity: number;
  cartNotes?: string;
}

type PaymentMethod = "CASH" | "CARD" | "DIGITAL_WALLET" | "SPLIT";

export function PosScreen({ sessionId: propSessionId }: { sessionId?: string }) {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Destination selection (Session vs Walk-in)
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [destinationMode, setDestinationMode] = useState<"walkin" | "session">(
    propSessionId ? "session" : "walkin"
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    propSessionId || ""
  );

  // Orders on current session
  const [sessionOrders, setSessionOrders] = useState<any[]>([]);

  // Barcode scanner buffer
  const [barcodeBuffer, setBarcodeBuffer] = useState("");

  // Payment Tender Modal State (Option A)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [splitCashAmount, setSplitCashAmount] = useState<string>("");
  const [splitCardAmount, setSplitCardAmount] = useState<string>("");

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [cats, itms] = await Promise.all([
        CanteenApi.getCategories(),
        CanteenApi.getMenuItems(undefined, true),
      ]);
      setCategories(cats.filter((c) => c.isActive));
      setItems(itms.filter((i) => i.isActive && i.isAvailable));
    } catch (err: any) {
      console.warn("Failed to load POS data from server, falling back to local cache:", err);
      try {
        const [cats, itms] = await Promise.all([
          CanteenApi.getCategories(),
          CanteenApi.getMenuItems(undefined, true),
        ]);
        setCategories(cats.filter((c) => c.isActive));
        setItems(itms.filter((i) => i.isActive && i.isAvailable));
      } catch (fallbackErr: any) {
        setError(fallbackErr.message || "Failed to load POS data");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const sessions = await sessionApi.active(user?.branchId);
      setActiveSessions(sessions);
      if (sessions.length > 0 && !selectedSessionId && !propSessionId) {
        setSelectedSessionId(sessions[0].id);
      }
    } catch (err) {
      console.error("Failed to load active sessions for canteen POS:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadSessionOrders = async (sId: string) => {
    if (!sId) {
      setSessionOrders([]);
      return;
    }
    try {
      const orders = await CanteenApi.getSessionOrders(sId);
      setSessionOrders(orders || []);
    } catch (err) {
      console.warn("Failed to load session orders:", err);
    }
  };

  useEffect(() => {
    loadData();
    if (!propSessionId) {
      loadActiveSessions();
    }
  }, [user?.branchId]);

  useEffect(() => {
    const sId = propSessionId || (destinationMode === "session" ? selectedSessionId : "");
    if (sId) {
      loadSessionOrders(sId);
    } else {
      setSessionOrders([]);
    }
  }, [propSessionId, destinationMode, selectedSessionId]);

  useEffect(() => {
    const handleSyncUpdate = () => {
      loadData();
      if (!propSessionId) {
        loadActiveSessions();
      }
      const sId = propSessionId || (destinationMode === "session" ? selectedSessionId : "");
      if (sId) {
        loadSessionOrders(sId);
      }
    };
    window.addEventListener("cuecloud:offline-queue-changed", handleSyncUpdate);
    window.addEventListener("cuecloud:canteen-order-created", handleSyncUpdate);
    window.addEventListener("online", handleSyncUpdate);
    return () => {
      window.removeEventListener("cuecloud:offline-queue-changed", handleSyncUpdate);
      window.removeEventListener("cuecloud:canteen-order-created", handleSyncUpdate);
      window.removeEventListener("online", handleSyncUpdate);
    };
  }, [propSessionId, destinationMode, selectedSessionId]);

  // HID Barcode Scanner Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

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

  const handleBarcodeScanned = useCallback(
    (scannedBarcode: string) => {
      const trimmed = scannedBarcode.trim();
      const matchedItem = items.find(
        (i) => i.barcode && i.barcode.toLowerCase() === trimmed.toLowerCase()
      );
      if (matchedItem) {
        addToCart(matchedItem);
        toast.success(`Scanned: ${matchedItem.name}`);
      } else {
        toast.error(`Barcode not found: ${trimmed}`);
      }
    },
    [items]
  );

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i
        );
      }
      return [...prev, { ...item, cartQuantity: 1, cartNotes: "" }];
    });
  };

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + Number(item.currentPrice) * item.cartQuantity,
      0
    );
  }, [cart]);

  const totalQuantity = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.cartQuantity, 0);
  }, [cart]);

  const targetSession = useMemo(() => {
    const sId = propSessionId || (destinationMode === "session" ? selectedSessionId : null);
    if (!sId) return null;
    return activeSessions.find((s) => s.id === sId) || null;
  }, [propSessionId, destinationMode, selectedSessionId, activeSessions]);

  // Cash change calculation
  const numericCashTendered = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, numericCashTendered - cartTotal);

  // Trigger Checkout
  const handleInitiateCheckout = () => {
    if (cart.length === 0) return;

    if (destinationMode === "session" && !selectedSessionId && !propSessionId) {
      toast.error("Please select an active table session");
      return;
    }

    // For Table Sessions, issue directly (paid when session closes)
    if (destinationMode === "session" || propSessionId) {
      void processSessionOrder();
    } else {
      // For Walk-in sales, open tender selection modal
      setCashTendered(String(cartTotal));
      setSplitCashAmount("");
      setSplitCardAmount("");
      setPaymentReference("");
      setPaymentMethod("CASH");
      setShowPaymentModal(true);
    }
  };

  // 1. Process Order added to Table Session
  const processSessionOrder = async () => {
    const finalSessionId = propSessionId || (destinationMode === "session" ? selectedSessionId : null);
    if (!finalSessionId) return;

    try {
      setIsSubmitting(true);
      const payload = cart.map((c) => ({
        menuItemId: c.id,
        quantity: c.cartQuantity,
        notes: c.cartNotes || undefined,
      }));

      await CanteenApi.addItemsToSession(finalSessionId, payload);
      const sessionLabel = targetSession
        ? `Table ${targetSession.table.tableNumber}`
        : "session";
      toast.success(`Items successfully added to ${sessionLabel}!`);
      loadSessionOrders(finalSessionId);
      setCart([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to process order");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Process Walk-in Direct Order with Payment Recording
  const processWalkInOrder = async () => {
    if (paymentMethod === "CASH" && numericCashTendered < cartTotal) {
      toast.error(`Cash received is less than total amount (PKR ${cartTotal.toFixed(2)})`);
      return;
    }

    if (paymentMethod === "SPLIT") {
      const splitCash = parseFloat(splitCashAmount) || 0;
      const splitCard = parseFloat(splitCardAmount) || 0;
      if (Math.abs(splitCash + splitCard - cartTotal) > 0.01) {
        toast.error(`Split payments must equal total amount of PKR ${cartTotal.toFixed(2)}`);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const itemsPayload = cart.map((c) => ({
        menuItemId: c.id,
        quantity: c.cartQuantity,
        unitPrice: Number(c.currentPrice),
        notes: c.cartNotes || undefined,
      }));

      // Structure payment tenders
      let payments: Array<{ method: string; amount: number; reference?: string }> = [];
      if (paymentMethod === "CASH") {
        payments = [{ method: "CASH", amount: cartTotal }];
      } else if (paymentMethod === "CARD") {
        payments = [{ method: "CARD", amount: cartTotal, reference: paymentReference || undefined }];
      } else if (paymentMethod === "DIGITAL_WALLET") {
        payments = [{ method: "WALLET", amount: cartTotal, reference: paymentReference || undefined }];
      } else if (paymentMethod === "SPLIT") {
        payments = [
          { method: "CASH", amount: parseFloat(splitCashAmount) || 0 },
          { method: "CARD", amount: parseFloat(splitCardAmount) || 0, reference: paymentReference || undefined },
        ];
      }

      const orderPayload = {
        items: itemsPayload,
        payments,
        totalAmount: cartTotal,
        amountTendered: paymentMethod === "CASH" ? numericCashTendered : cartTotal,
        changeDue: paymentMethod === "CASH" ? changeDue : 0,
      };

      // Call API (supports both new object payload and legacy array payload)
      await (CanteenApi.createStandaloneOrder as any)(orderPayload);

      toast.success(
        paymentMethod === "CASH" && changeDue > 0
          ? `Sale completed! Change due: PKR ${changeDue.toFixed(2)}`
          : "Walk-in sale completed and invoice generated!"
      );

      setShowPaymentModal(false);
      setCart([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to process walk-in sale");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <p className="text-sm text-slate-500">Loading Canteen POS...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4 text-rose-600">
        <AlertCircle className="h-10 w-10" />
        <p className="text-lg font-semibold text-slate-900">Error Loading POS Data</p>
        <p className="text-sm text-slate-500">{error}</p>
        <Button onClick={loadData} variant="secondary" className="w-auto">
          Try Again
        </Button>
      </div>
    );
  }

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      activeCategory === null || item.categoryId === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.barcode &&
        item.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full min-h-[78vh] gap-4">
      {!isOnline && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Offline Mode — Menu and orders are operational locally and will sync automatically when reconnected.</span>
          </div>
          <span className="text-amber-800 font-bold px-2 py-0.5 rounded bg-amber-100 border border-amber-200">Local POS Active</span>
        </div>
      )}
      <div className="flex flex-col lg:flex-row h-full gap-6">
        {/* LEFT SECTION: Search, Category Filters & Products Grid */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search products by name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 text-sm bg-white border-slate-200 rounded-xl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-500 shadow-sm">
            <ScanBarcode className="w-4 h-4 text-brand-600" />
            <span>Scanner Ready</span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
              activeCategory === null
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            All Items ({items.length})
          </button>
          {categories.map((c) => {
            const count = items.filter((i) => i.categoryId === c.id).length;
            const isSelected = activeCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                <span>{c.name}</span>
                <span className="text-xs opacity-70 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Products Grid */}
        {filteredItems.length === 0 ? (
          <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-300 p-8 bg-slate-50">
            <Coffee className="w-12 h-12 mb-3 text-slate-300" />
            <p className="font-semibold text-slate-700">
              No available canteen products found
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchQuery
                ? `No products matching "${searchQuery}". Check spelling or try a different term.`
                : "No active products are available in this category."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[1200px]:grid-cols-2 2xl:grid-cols-4 gap-3.5 overflow-y-auto">
            {filteredItems.map((item) => {
              const inCartItem = cart.find((c) => c.id === item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`relative border rounded-xl p-4 cursor-pointer transition-all duration-150 flex flex-col justify-between bg-white select-none group hover:shadow-md hover:border-brand-300 hover:-translate-y-0.5 ${
                    inCartItem
                      ? "ring-2 ring-brand-500 border-brand-400 bg-brand-50/50"
                      : "border-slate-200 shadow-sm"
                  }`}
                >
                  {inCartItem && (
                    <span className="absolute top-2.5 right-2.5 bg-brand-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                      {inCartItem.cartQuantity}
                    </span>
                  )}

                  <div>
                    <h4 className="font-bold text-sm text-slate-900 line-clamp-2 group-hover:text-brand-700 transition-colors">
                      {item.name}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-end justify-between gap-x-2 gap-y-1 border-t border-slate-100 pt-2">
                    <span className="min-w-0 flex-1 whitespace-nowrap font-extrabold text-sm text-brand-700 font-mono 2xl:text-base">
                      Rs. {Number(item.currentPrice).toFixed(2)}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-slate-400 group-hover:text-brand-600 transition-colors flex items-center gap-0.5">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT SECTION: Cart / Order Checkout Panel */}
      <div className="w-full lg:w-96 shrink-0 flex flex-col border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
        {/* Panel Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-50 text-brand-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Canteen Order
              </h3>
              <p className="text-xs text-slate-500">
                {cart.length > 0
                  ? `${totalQuantity} item${totalQuantity > 1 ? "s" : ""} selected`
                  : "Ready for items"}
              </p>
            </div>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Order Destination Selector (Session vs Walk-in) */}
        {!propSessionId && (
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Order Destination
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setDestinationMode("walkin")}
                className={`py-1.5 px-2 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  destinationMode === "walkin"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <User className="w-3.5 h-3.5" /> Walk-in Sale
              </button>
              <button
                type="button"
                onClick={() => {
                  setDestinationMode("session");
                  if (activeSessions.length === 0) {
                    loadActiveSessions();
                  }
                }}
                className={`py-1.5 px-2 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  destinationMode === "session"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Armchair className="w-3.5 h-3.5" /> Table Session
              </button>
            </div>

            {destinationMode === "session" && (
              <div className="pt-1">
                {isLoadingSessions ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                    <span>Loading active tables...</span>
                  </div>
                ) : activeSessions.length === 0 ? (
                  <div className="p-2.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs">
                    No active table sessions on this branch right now.
                  </div>
                ) : (
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none font-medium focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer"
                  >
                    {activeSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        Table {s.table.tableNumber} -{" "}
                        {s.customer?.fullName || "Walk-in Guest"}
                      </option>
                    ))}
                  </select>
                )}
                {selectedSessionId && sessionOrders.length > 0 && (
                  <div className="mt-2 p-2 rounded-lg bg-white border border-slate-200">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700 mb-1">
                      <span>Existing Table Orders:</span>
                      <span className="font-mono text-brand-700">
                        Rs. {sessionOrders.reduce((sum, ord) => sum + (ord.items || []).reduce((s: number, it: any) => s + (it.lineTotal || 0), 0), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                      {sessionOrders.flatMap((ord) => ord.items || []).map((it: any, idx: number) => (
                        <div key={it.id || idx} className="flex justify-between items-center text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                          <span className="truncate max-w-[170px]">{it.quantity}x {it.menuItem?.name || "Item"}</span>
                          <span className="font-mono font-medium">Rs. {Number(it.lineTotal || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* If locked to a specific sessionId prop */}
        {propSessionId && targetSession && (
          <div className="p-3 border-b border-slate-100 bg-brand-50 text-xs text-brand-700 font-medium">
            <div className="flex items-center gap-2">
              <Armchair className="w-4 h-4" />
              <span>
                Issuing to Table {targetSession.table.tableNumber} (
                {targetSession.customer?.fullName || "Walk-in"})
              </span>
            </div>
            {sessionOrders.length > 0 && (
              <div className="mt-2 p-2 rounded-lg bg-white/80 border border-brand-200 text-slate-700">
                <div className="flex justify-between items-center text-[11px] font-semibold mb-1">
                  <span>Current Orders:</span>
                  <span className="font-mono text-brand-700">
                    Rs. {sessionOrders.reduce((sum, ord) => sum + (ord.items || []).reduce((s: number, it: any) => s + (it.lineTotal || 0), 0), 0).toFixed(2)}
                  </span>
                </div>
                <div className="space-y-0.5 max-h-20 overflow-y-auto">
                  {sessionOrders.flatMap((ord) => ord.items || []).map((it: any, idx: number) => (
                    <div key={it.id || idx} className="flex justify-between text-[10px]">
                      <span>{it.quantity}x {it.menuItem?.name || "Item"}</span>
                      <span className="font-mono">Rs. {Number(it.lineTotal || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-300">
                <ShoppingCart className="w-7 h-7" />
              </div>
              <p className="font-semibold text-sm text-slate-700">
                Cart is Empty
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                Click on menu products or scan a barcode to add to order
              </p>
            </div>
          ) : (
            cart.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-2 p-3 border border-slate-200 rounded-xl bg-slate-50/50 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm text-slate-900 leading-tight">
                    {c.name}
                  </span>
                  <span className="font-extrabold text-sm text-slate-900 font-mono ml-2 shrink-0">
                    Rs. {(Number(c.currentPrice) * c.cartQuantity).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                    <button
                      type="button"
                      className="h-6 w-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                      onClick={() =>
                        c.cartQuantity > 1
                          ? updateCartItem(c.id, {
                              cartQuantity: c.cartQuantity - 1,
                            })
                          : removeFromCart(c.id)
                      }
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-bold text-xs font-mono text-slate-900">
                      {c.cartQuantity}
                    </span>
                    <button
                      type="button"
                      className="h-6 w-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                      onClick={() =>
                        updateCartItem(c.id, {
                          cartQuantity: c.cartQuantity + 1,
                        })
                      }
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="text-xs text-slate-400 font-mono">
                    Rs. {Number(c.currentPrice).toFixed(2)} each
                  </span>

                  <button
                    type="button"
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    onClick={() => removeFromCart(c.id)}
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Notes input */}
                <div className="relative mt-1">
                  <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Notes (e.g. cold, extra spicy, sauce)"
                    className="h-7 w-full text-xs pl-7 pr-2 rounded-lg border border-slate-200 bg-white text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all placeholder:text-slate-400"
                    value={c.cartNotes || ""}
                    onChange={(e) =>
                      updateCartItem(c.id, { cartNotes: e.target.value })
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel Footer / Checkout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Items Subtotal:</span>
              <span className="font-mono">Rs. {cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center font-black text-lg text-slate-900 pt-1">
              <span>Grand Total:</span>
              <span className="text-brand-700 font-mono">
                Rs. {cartTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <Button
            className="w-full h-12 text-sm font-bold gap-2 cursor-pointer"
            disabled={
              cart.length === 0 ||
              isSubmitting ||
              (destinationMode === "session" &&
                !selectedSessionId &&
                !propSessionId)
            }
            onClick={handleInitiateCheckout}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing...
              </>
            ) : destinationMode === "session" || propSessionId ? (
              <>
                <Armchair className="w-4 h-4" /> Issue to Table (
                {targetSession ? targetSession.table.tableNumber : "Session"})
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Complete Direct Order
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          OPTION A: WALK-IN PAYMENT & TENDER MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Walk-in Direct Payment
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select tender to generate invoice & receipt
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Display Banner */}
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Bill Due
              </span>
              <p className="text-3xl font-black text-slate-900 font-mono mt-0.5">
                PKR {cartTotal.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {totalQuantity} item{totalQuantity > 1 ? "s" : ""} from canteen
              </p>
            </div>

            {/* Tender Method Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Payment Tender
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === "CASH"
                      ? "border-emerald-600 bg-emerald-50/80 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("CARD")}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === "CARD"
                      ? "border-indigo-600 bg-indigo-50/80 text-indigo-800 ring-2 ring-indigo-500/20 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("DIGITAL_WALLET")}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === "DIGITAL_WALLET"
                      ? "border-purple-600 bg-purple-50/80 text-purple-800 ring-2 ring-purple-500/20 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-purple-600" />
                  <span>Raast/Wallet</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("SPLIT");
                    setSplitCashAmount(String(Math.floor(cartTotal / 2)));
                    setSplitCardAmount(String(cartTotal - Math.floor(cartTotal / 2)));
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === "SPLIT"
                      ? "border-amber-600 bg-amber-50/80 text-amber-800 ring-2 ring-amber-500/20 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Split className="w-4 h-4 text-amber-600" />
                  <span>Split</span>
                </button>
              </div>
            </div>

            {/* CASH Tender Fields & Quick Cash Presets */}
            {paymentMethod === "CASH" && (
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Cash Received (PKR)
                    </label>
                    <span className="text-xs text-slate-400">Bill: PKR {cartTotal.toFixed(2)}</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min={cartTotal}
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-mono font-bold text-slate-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                    placeholder="Enter cash given by customer..."
                    autoFocus
                  />
                </div>

                {/* Quick Note Presets */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCashTendered(String(cartTotal))}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    Exact ({cartTotal.toFixed(0)})
                  </button>
                  {[500, 1000, 5000].map((preset) => {
                    if (preset < cartTotal && cartTotal > 500) return null;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashTendered(String(preset))}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      >
                        PKR {preset}
                      </button>
                    );
                  })}
                </div>

                {/* Change Due Readout */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                    Change Due to Customer:
                  </span>
                  <span className="text-lg font-black text-emerald-700 font-mono">
                    PKR {changeDue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* CARD & DIGITAL WALLET Reference */}
            {(paymentMethod === "CARD" || paymentMethod === "DIGITAL_WALLET") && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Transaction / Approval Code{" "}
                  <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Card Ref #1234 or Raast TID"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                />
              </div>
            )}

            {/* SPLIT TENDER Fields */}
            {paymentMethod === "SPLIT" && (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Cash Portion
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 300"
                      value={splitCashAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitCashAmount(val);
                        const remainder = cartTotal - (parseFloat(val) || 0);
                        setSplitCardAmount(remainder > 0 ? remainder.toFixed(2) : "0");
                      }}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-mono font-bold text-slate-900 outline-none focus:border-brand-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Card / Digital Portion
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 280"
                      value={splitCardAmount}
                      onChange={(e) => setSplitCardAmount(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-mono font-bold text-slate-900 outline-none focus:border-brand-500 focus:bg-white"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500 px-1">
                  <span>Split Total:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    PKR {((parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0)).toFixed(2)} / {cartTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowPaymentModal(false)}
                className="w-1/3 h-11 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSubmitting || (paymentMethod === "CASH" && numericCashTendered < cartTotal)}
                onClick={processWalkInOrder}
                className="w-2/3 h-11 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Recording Sale...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Confirm & Issue Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
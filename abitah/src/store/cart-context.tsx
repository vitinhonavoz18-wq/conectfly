"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { siteConfig } from "@/config/site";
import type { AppliedCoupon, CartItem, ShippingOptionId } from "@/types/cart";

const STORAGE_KEY = "abitah:cart:v1";
const COUPON_KEY = "abitah:coupon:v1";

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  count: number;
  subtotal: number;
  discount: number;
  shippingPrice: number;
  total: number;
  coupon: AppliedCoupon | null;
  shippingOption: ShippingOptionId;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "key">, quantity?: number) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  applyCoupon: (coupon: AppliedCoupon | null) => void;
  setShippingOption: (option: ShippingOptionId) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function cartItemKey(productId: string, size: string, color: string) {
  return `${productId}::${size}::${color}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { value: items, setValue: setItems, hydrated } = useLocalStorage<CartItem[]>(STORAGE_KEY, []);
  const { value: coupon, setValue: setCoupon } = useLocalStorage<AppliedCoupon | null>(COUPON_KEY, null);
  const [shippingOption, setShippingOption] = useState<ShippingOptionId>("standard");
  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback<CartContextValue["addItem"]>(
    (item, quantity = 1) => {
      const key = cartItemKey(item.productId, item.size, item.color);
      setItems((current) => {
        const existing = current.find((line) => line.key === key);
        if (existing) {
          const nextQuantity = Math.min(existing.quantity + quantity, existing.maxQuantity || 99);
          return current.map((line) =>
            line.key === key ? { ...line, quantity: nextQuantity } : line,
          );
        }
        return [...current, { ...item, key, quantity: Math.max(1, quantity) }];
      });
      setIsOpen(true);
    },
    [setItems],
  );

  const updateQuantity = useCallback<CartContextValue["updateQuantity"]>(
    (key, quantity) => {
      setItems((current) =>
        quantity <= 0
          ? current.filter((line) => line.key !== key)
          : current.map((line) =>
              line.key === key
                ? { ...line, quantity: Math.min(quantity, line.maxQuantity || 99) }
                : line,
            ),
      );
    },
    [setItems],
  );

  const removeItem = useCallback<CartContextValue["removeItem"]>(
    (key) => setItems((current) => current.filter((line) => line.key !== key)),
    [setItems],
  );

  const clear = useCallback(() => {
    setItems([]);
    setCoupon(null);
  }, [setItems, setCoupon]);

  const subtotal = useMemo(
    () => items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [items],
  );

  const count = useMemo(() => items.reduce((sum, line) => sum + line.quantity, 0), [items]);

  const discount = useMemo(() => {
    if (!coupon) return 0;
    return Math.min(coupon.discount, subtotal);
  }, [coupon, subtotal]);

  const shippingPrice = useMemo(() => {
    if (!items.length) return 0;
    const option = siteConfig.commerce.shipping[shippingOption];
    const threshold = siteConfig.commerce.freeShippingThreshold;
    if (shippingOption === "pickup") return 0;
    if (threshold > 0 && subtotal - discount >= threshold) return 0;
    return option.price;
  }, [items.length, shippingOption, subtotal, discount]);

  const total = Math.max(0, subtotal - discount) + shippingPrice;

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,
      count,
      subtotal,
      discount,
      shippingPrice,
      total,
      coupon,
      shippingOption,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      updateQuantity,
      removeItem,
      clear,
      applyCoupon: setCoupon,
      setShippingOption,
    }),
    [
      items,
      hydrated,
      count,
      subtotal,
      discount,
      shippingPrice,
      total,
      coupon,
      shippingOption,
      isOpen,
      addItem,
      updateQuantity,
      removeItem,
      clear,
      setCoupon,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart deve ser usado dentro de <CartProvider>");
  return context;
}

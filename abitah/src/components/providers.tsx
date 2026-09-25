"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { CartProvider } from "@/store/cart-context";
import { FavoritesProvider } from "@/store/favorites-context";
import { AuthProvider } from "@/store/auth-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>{children}</CartProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

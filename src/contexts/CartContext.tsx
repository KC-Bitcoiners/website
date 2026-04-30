import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ClassifiedListing, ListingPrice } from "@/types/classifieds";

const CART_STORAGE_KEY = "bodarc-cart";

export interface CartItem {
  listingId: string; // event.id
  pubkey: string; // seller pubkey
  title: string;
  price?: ListingPrice;
  image?: string; // first image URL
  quantity: number;
  addedAt: number; // timestamp
}

interface CartContextType {
  items: CartItem[];
  cartCount: number;
  cartTotalSats: number; // sum of sats-priced items
  addToCart: (listing: ClassifiedListing) => void;
  removeFromCart: (listingId: string) => void;
  updateQuantity: (listingId: string, qty: number) => void;
  clearCart: () => void;
  isInCart: (listingId: string) => boolean;
}

const CartContext = createContext<CartContextType | null>(null);

/** Load cart from localStorage */
function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/** Save cart to localStorage */
function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full or unavailable — non-critical
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    setItems(loadCart());
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addToCart = useCallback((listing: ClassifiedListing) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.listingId === listing.id);
      if (existing) {
        return prev.map((i) =>
          i.listingId === listing.id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          listingId: listing.id,
          pubkey: listing.pubkey,
          title: listing.title,
          price: listing.price,
          image: listing.images[0],
          quantity: 1,
          addedAt: Date.now(),
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((listingId: string) => {
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
  }, []);

  const updateQuantity = useCallback((listingId: string, qty: number) => {
    if (qty < 1) {
      setItems((prev) => prev.filter((i) => i.listingId !== listingId));
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.listingId === listingId ? { ...i, quantity: qty } : i,
      ),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback(
    (listingId: string) => items.some((i) => i.listingId === listingId),
    [items],
  );

  // Sum only sats-priced items for total
  const cartTotalSats = items.reduce((sum, item) => {
    if (item.price?.currency.toLowerCase() === "sats") {
      const amt = parseFloat(item.price.amount);
      if (!isNaN(amt)) return sum + amt * item.quantity;
    }
    return sum;
  }, 0);

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        cartCount,
        cartTotalSats,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/** Hook to access cart state and actions */
export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

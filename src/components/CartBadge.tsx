import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import CartDrawer from "./CartDrawer";

interface CartBadgeProps {
  onCheckout?: () => void;
}

/** Floating cart badge — bottom-right, only shows when cart has items */
export default function CartBadge({ onCheckout }: CartBadgeProps) {
  const { cartCount } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (cartCount === 0) return null;

  return (
    <>
      <button
        data-testid="cart-badge"
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-bitcoin-orange text-white w-14 h-14 rounded-full shadow-lg hover:shadow-xl hover:bg-orange-600 transition-all flex items-center justify-center"
        title="View Cart"
      >
        <span className="text-xl">🛒</span>
        <span className="absolute -top-1 -right-1 bg-white text-bitcoin-orange text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
          {cartCount > 9 ? "9+" : cartCount}
        </span>
      </button>

      {drawerOpen && (
        <CartDrawer
          onClose={() => setDrawerOpen(false)}
          onCheckout={() => {
            setDrawerOpen(false);
            onCheckout?.();
          }}
        />
      )}
    </>
  );
}

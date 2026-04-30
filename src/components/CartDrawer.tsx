import { useCart, CartItem } from "@/contexts/CartContext";

/** Format price for a cart item */
function formatItemPrice(item: CartItem): string {
  if (!item.price) return "";
  const { amount, currency, frequency } = item.price;
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  if (currency.toLowerCase() === "sats") {
    const formatted = Math.round(num).toLocaleString();
    return `${formatted} sats${frequency ? `/${frequency}` : ""}`;
  }
  const symbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };
  const sym = symbols[currency] || `${currency} `;
  return `${sym}${num.toLocaleString()}${frequency ? `/${frequency}` : ""}`;
}

interface CartDrawerProps {
  onClose: () => void;
  onCheckout: () => void;
}

/** Slide-in drawer showing cart contents */
export default function CartDrawer({ onClose, onCheckout }: CartDrawerProps) {
  const { items, cartTotalSats, removeFromCart, updateQuantity, clearCart } =
    useCart();

  // Separate sats and fiat items for display
  const satsItems = items.filter(
    (i) => i.price?.currency.toLowerCase() === "sats",
  );
  const fiatItems = items.filter(
    (i) => i.price && i.price.currency.toLowerCase() !== "sats",
  );
  const freeItems = items.filter((i) => !i.price);

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        data-testid="cart-drawer"
        className="absolute right-0 top-0 bottom-0 w-full sm:max-w-md bg-white shadow-2xl flex flex-col animate-slide-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Shopping Cart</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {items.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">🛒</div>
              <p>Your cart is empty</p>
            </div>
          )}

          {satsItems.map((item) => (
            <CartItemRow
              key={item.listingId}
              item={item}
              onRemove={() => removeFromCart(item.listingId)}
              onUpdateQty={(qty) => updateQuantity(item.listingId, qty)}
            />
          ))}

          {fiatItems.map((item) => (
            <CartItemRow
              key={item.listingId}
              item={item}
              onRemove={() => removeFromCart(item.listingId)}
              onUpdateQty={(qty) => updateQuantity(item.listingId, qty)}
            />
          ))}

          {freeItems.map((item) => (
            <CartItemRow
              key={item.listingId}
              item={item}
              onRemove={() => removeFromCart(item.listingId)}
              onUpdateQty={(qty) => updateQuantity(item.listingId, qty)}
            />
          ))}
        </div>

        {/* Footer with totals and checkout */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{items.length} item{items.length !== 1 ? "s" : ""}</span>
              {cartTotalSats > 0 && (
                <span className="font-bold text-bitcoin-orange">
                  ⚡ {cartTotalSats.toLocaleString()} sats
                </span>
              )}
            </div>

            <button
              data-testid="checkout-btn"
              onClick={onCheckout}
              className="w-full py-3 bg-bitcoin-orange text-white rounded-lg hover:bg-orange-600 text-sm font-semibold transition-colors"
            >
              Checkout ({items.length} item{items.length !== 1 ? "s" : ""})
            </button>

            <div className="flex gap-3">
              <button
                onClick={clearCart}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Clear Cart
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-in animation */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

/** Single cart item row */
function CartItemRow({
  item,
  onRemove,
  onUpdateQty,
}: {
  item: CartItem;
  onRemove: () => void;
  onUpdateQty: (qty: number) => void;
}) {
  return (
    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
      {/* Thumbnail */}
      {item.image ? (
        <img
          src={item.image}
          alt={item.title}
          className="w-16 h-16 object-cover rounded"
        />
      ) : (
        <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
          No image
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">
          {item.title}
        </h4>
        {item.price && (
          <p className="text-xs text-bitcoin-orange font-semibold">
            {formatItemPrice(item)}
          </p>
        )}

        {/* Quantity controls */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => onUpdateQty(item.quantity - 1)}
            className="w-8 h-8 rounded bg-gray-200 text-gray-700 text-sm hover:bg-gray-300 flex items-center justify-center"
          >
            −
          </button>
          <span className="text-sm font-medium w-6 text-center">
            {item.quantity}
          </span>
          <button
            onClick={() => onUpdateQty(item.quantity + 1)}
            className="w-8 h-8 rounded bg-gray-200 text-gray-700 text-sm hover:bg-gray-300 flex items-center justify-center"
          >
            +
          </button>
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 text-sm self-start p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}

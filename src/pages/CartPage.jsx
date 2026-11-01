import { ShoppingCart, Trash2, Minus, Plus, MessageCircle } from 'lucide-react'
import { useCart } from '../hooks/useCart'
import { formatPrice } from '../utils/helpers'

// Seller WhatsApp number (international format, no leading +/0) — same
// number used for the "Contact Seller" button on the product detail page.
const SELLER_WHATSAPP = '6285717369022'
const MY_PHONE_NOTE = '085717369022'

/**
 * Build the WhatsApp checkout message by listing every item in the cart.
 */
function buildCheckoutMessage(items, totalPrice) {
  const lines = items.map(
    (it) => `- ${it.name} x${it.qty} (${formatPrice(it.price * it.qty)})`,
  )
  return [
    'Hi, aku mau pesan:',
    ...lines,
    '',
    `Total: ${formatPrice(totalPrice)}`,
    `(nomor saya ${MY_PHONE_NOTE})`,
  ].join('\n')
}

export default function CartPage({ onNavigateCatalog }) {
  const { items, removeFromCart, updateQty, totalCount, totalPrice, clearCart } = useCart()

  const handleCheckout = () => {
    if (items.length === 0) return
    const message = buildCheckoutMessage(items, totalPrice)
    const waHref = `https://wa.me/${SELLER_WHATSAPP}?text=${encodeURIComponent(message)}`
    window.open(waHref, '_blank', 'noopener,noreferrer')
  }

  if (items.length === 0) {
    return (
      <div className="state-box">
        <ShoppingCart size={28} />
        <p>Your cart is empty.</p>
        {onNavigateCatalog && (
          <button type="button" className="btn btn--outline" onClick={onNavigateCatalog}>
            Browse Catalog
          </button>
        )}
      </div>
    )
  }

  return (
    <section>
      <div className="list-head">
        <h2>Your Cart</h2>
        <div className="list-head-right">
          <span className="count">{totalCount} item{totalCount !== 1 ? 's' : ''}</span>
          <button type="button" className="btn btn--outline btn--sm" onClick={clearCart}>
            Clear Cart
          </button>
        </div>
      </div>

      <ul className="cart-list">
        {items.map((it) => (
          <li key={it.id} className="cart-item">
            <img className="cart-item-img" src={it.image} alt={it.name} />
            <div className="cart-item-info">
              <span className="name">{it.name}</span>
              <span className="price">{formatPrice(it.price)}</span>
            </div>
            <div className="cart-item-qty">
              <button
                type="button"
                className="card-act-btn"
                onClick={() => updateQty(it.id, it.qty - 1)}
                aria-label={`Decrease ${it.name} quantity`}
              >
                <Minus size={14} />
              </button>
              <span>{it.qty}</span>
              <button
                type="button"
                className="card-act-btn"
                onClick={() => updateQty(it.id, it.qty + 1)}
                aria-label={`Increase ${it.name} quantity`}
              >
                <Plus size={14} />
              </button>
            </div>
            <span className="cart-item-subtotal">{formatPrice(it.price * it.qty)}</span>
            <button
              type="button"
              className="card-act-btn card-act-btn--danger"
              onClick={() => removeFromCart(it.id)}
              aria-label={`Remove ${it.name} from cart`}
              title="Remove"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      <div className="cart-summary">
        <span className="cart-total">Total: {formatPrice(totalPrice)}</span>
        <button type="button" className="btn btn--primary" onClick={handleCheckout}>
          <MessageCircle size={16} /> Checkout via WhatsApp
        </button>
      </div>
    </section>
  )
}

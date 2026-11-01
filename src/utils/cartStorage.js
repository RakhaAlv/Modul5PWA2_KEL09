import { formatPrice } from './helpers'

const CART_KEY = 'bore_barrel_cart'
export const DEFAULT_SELLER_PHONE = '6285717369022'

/**
 * Get current cart items from localStorage.
 * @returns {Array}
 */
export const getCart = () => {
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Persist cart items and notify listeners.
 * @param {Array} cart
 */
export const saveCart = (cart) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart_updated', { detail: cart }))
    return true
  } catch (err) {
    console.warn('Failed to save cart:', err)
    return false
  }
}

/**
 * Add an item or increment its quantity in the cart.
 * @param {Object} gun
 * @param {number} [quantity=1]
 */
export const addToCart = (gun, quantity = 1) => {
  if (!gun) return false
  const cart = getCart()
  const gunId = String(gun.id || gun.name)
  const existingIndex = cart.findIndex((item) => String(item.id) === gunId)

  const itemPrice = Number(gun.price ?? gun.cook_time ?? 0)
  const itemImage =
    (Array.isArray(gun.images) && gun.images[0]) ||
    gun.image_url ||
    gun.image ||
    '/guns/pistol.svg'

  if (existingIndex > -1) {
    cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + quantity
  } else {
    cart.push({
      id: gunId,
      name: gun.name || 'Hardware Piece',
      price: itemPrice,
      caliber: gun.caliber || '',
      type: gun.type || gun.category || 'Hardware',
      image: itemImage,
      quantity: Math.max(1, quantity),
    })
  }

  saveCart(cart)
  return true
}

/**
 * Remove an item completely from the cart.
 * @param {string|number} gunId
 */
export const removeFromCart = (gunId) => {
  const cart = getCart().filter((item) => String(item.id) !== String(gunId))
  saveCart(cart)
  return cart
}

/**
 * Update quantity of a cart item directly or by delta.
 * If new quantity <= 0, the item is removed.
 * @param {string|number} gunId
 * @param {number} value
 * @param {boolean} [isDelta=false]
 */
export const updateQuantity = (gunId, value, isDelta = false) => {
  let cart = getCart()
  const index = cart.findIndex((item) => String(item.id) === String(gunId))
  if (index === -1) return cart

  const newQty = isDelta ? (cart[index].quantity || 1) + value : value
  if (newQty <= 0) {
    cart = cart.filter((item) => String(item.id) !== String(gunId))
  } else {
    cart[index].quantity = newQty
  }

  saveCart(cart)
  return cart
}

/**
 * Empty the cart.
 */
export const clearCart = () => {
  saveCart([])
  return true
}

/**
 * Total item count across all line items.
 * @param {Array} [cart]
 */
export const getCartCount = (cart = getCart()) => {
  return cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
}

/**
 * Total cart price.
 * @param {Array} [cart]
 */
export const getCartTotal = (cart = getCart()) => {
  return cart.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
    0,
  )
}

/**
 * Generate WhatsApp checkout URL with a formatted order message.
 * @param {Array} cart
 * @param {Object} customerInfo
 * @param {string} [phone]
 * @returns {string}
 */
export const generateWhatsAppCheckoutUrl = (
  cart = getCart(),
  customerInfo = {},
  phone = DEFAULT_SELLER_PHONE,
) => {
  if (!cart || cart.length === 0) return ''

  const lines = [
    'Hi, aku mau pesan:\n',
  ]

  cart.forEach((item, idx) => {
    const subtotal = (Number(item.price) || 0) * (Number(item.quantity) || 1)
    lines.push(
      `${idx + 1}. ${item.name} (${item.type || 'Item'}${item.caliber ? ` · ${item.caliber}` : ''})\n   Jumlah: ${item.quantity}x @ ${formatPrice(item.price)} = ${formatPrice(subtotal)}`,
    )
  })

  const total = getCartTotal(cart)
  lines.push(`\n*Total Tagihan: ${formatPrice(total)}*`)

  if (customerInfo.name || customerInfo.phone || customerInfo.notes) {
    lines.push('\n*Data Pemesan:*')
    if (customerInfo.name) lines.push(`- Nama: ${customerInfo.name}`)
    if (customerInfo.phone) lines.push(`- No. Kontak: ${customerInfo.phone}`)
    if (customerInfo.address) lines.push(`- Alamat: ${customerInfo.address}`)
    if (customerInfo.notes) lines.push(`- Catatan: ${customerInfo.notes}`)
  }

  lines.push('\nMohon konfirmasi ketersediaan dan instruksi pembayarannya. Terima kasih!')

  const messageText = lines.join('\n')
  let cleanPhone = phone.replace(/[^0-9]/g, '')
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1)
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
}

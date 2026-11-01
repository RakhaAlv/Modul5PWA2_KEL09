import { useState, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// useCart — shopping cart stored in localStorage.
//
// Cart items look like:
//   { id, name, price, image, qty }
//
// A tiny pub-sub (CustomEvent on window) keeps every component that calls
// useCart() in sync whenever the cart changes, without needing a Context
// provider wrapped around the app.
// ---------------------------------------------------------------------------

const LOCAL_KEY = 'bore_barrel_cart'
const CART_EVENT = 'bore_barrel_cart_updated'

const readCart = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeCart = (items) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items))
  } catch {
    /* quota exceeded — silently fail */
  }
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: items }))
}

export function useCart() {
  const [items, setItems] = useState(readCart)

  useEffect(() => {
    const onUpdate = (e) => setItems(e.detail ?? readCart())
    const onStorage = (e) => { if (e.key === LOCAL_KEY) setItems(readCart()) }
    window.addEventListener(CART_EVENT, onUpdate)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CART_EVENT, onUpdate)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const addToCart = useCallback((gun, qty = 1) => {
    const id = gun.id || gun.name
    const current = readCart()
    const idx = current.findIndex((it) => String(it.id) === String(id))
    let next
    if (idx === -1) {
      next = [
        ...current,
        {
          id,
          name: gun.name,
          price: Number(gun.price) || 0,
          image: gun.image_url || gun.image || '/guns/pistol.svg',
          qty,
        },
      ]
    } else {
      next = current.map((it, i) => (i === idx ? { ...it, qty: it.qty + qty } : it))
    }
    writeCart(next)
  }, [])

  const removeFromCart = useCallback((id) => {
    writeCart(readCart().filter((it) => String(it.id) !== String(id)))
  }, [])

  const updateQty = useCallback((id, qty) => {
    if (qty <= 0) {
      writeCart(readCart().filter((it) => String(it.id) !== String(id)))
      return
    }
    writeCart(readCart().map((it) => (String(it.id) === String(id) ? { ...it, qty } : it)))
  }, [])

  const clearCart = useCallback(() => writeCart([]), [])

  const totalCount = items.reduce((sum, it) => sum + it.qty, 0)
  const totalPrice = items.reduce((sum, it) => sum + it.qty * it.price, 0)

  return { items, addToCart, removeFromCart, updateQty, clearCart, totalCount, totalPrice }
}

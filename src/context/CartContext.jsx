import { createContext, useContext, useState } from "react"

const CartContext = createContext()

export function CartProvider({ children }) {
  const [cart, setCart] = useState([])
  const [hfPizza, setHfPizza] = useState(null)
  const [hfSize, setHfSize] = useState(null)

  function addToCart(product) {
    if (hfPizza) {
      const p1 = hfPizza
      const p2 = product
      const size = hfSize

      const price1 = size === 'M' ? Number(p1.price) : Number(p1.price_g || p1.price * 1.2)
      const price2 = size === 'M' ? Number(p2.price) : Number(p2.price_g || p2.price * 1.2)
      const finalPrice = Math.max(price1, price2)

      const combo = {
        id: `half-${Date.now()}`,
        name: `1/2 ${p1.name} / 1/2 ${p2.name} (${size})`,
        price: finalPrice,
        qty: 1,
        category: 'pizzas',
        observation: ""
      }

      setCart(prev => [...prev, combo])
      setHfPizza(null)
      setHfSize(null)
      return
    }

    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id)

      if (existing) {
        return prev.map((p) =>
          p.id === product.id ? { ...p, qty: p.qty + 1 } : p
        )
      }

      return [...prev, { ...product, qty: 1, price: Number(product.price), observation: "" }]
    })
  }

  function updateObservation(id, obs) {
    setCart((prev) =>
      prev.map((p) => (p.id === id ? { ...p, observation: obs } : p))
    )
  }

  function startHalfPizza(product, size) {
    setHfPizza(product)
    setHfSize(size)
  }

  function cancelHalfPizza() {
    setHfPizza(null)
    setHfSize(null)
  }

  function increase(id) {
    setCart((prev) =>
      prev.map((p) => (p.id === id ? { ...p, qty: p.qty + 1 } : p))
    )
  }

  function decrease(id) {
    setCart((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, qty: p.qty - 1 } : p))
        .filter((p) => p.qty > 0)
    )
  }

  function clearCart() {
    setCart([])
  }

  function getCartTotal() {
    return cart.reduce((sum, item) => sum + (Number(item.price) * (item.qty || 1)), 0)
  }

  function finalizeOrder(customerName = "Cliente", generalObs = "") {
    const freshTotal = getCartTotal()
    const order = {
      items: cart,
      total: freshTotal,
      orderNumber: Math.floor(Math.random() * 900) + 100,
      customerName: customerName || "Cliente",
      observation: generalObs
    }
    setLastOrder(order)
    return order
  }

  const [lastOrder, setLastOrder] = useState(null)

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        increase,
        decrease,
        getCartTotal,
        finalizeOrder,
        clearCart,
        lastOrder,
        hfPizza,
        hfSize,
        startHalfPizza,
        cancelHalfPizza,
        updateObservation
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}

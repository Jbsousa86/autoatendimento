import { createContext, useContext, useState } from "react"

const CartContext = createContext()

export function CartProvider({ children }) {
  const [cart, setCart] = useState([])
  const [lastOrder, setLastOrder] = useState(null)

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id)

      if (existing) {
        return prev.map((p) =>
          p.id === product.id ? { ...p, qty: p.qty + 1 } : p
        )
      }

      return [...prev, { ...product, qty: 1, price: Number(product.price) }]
    })
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

  function finalizeOrder(customerName = "Cliente") {
    const freshTotal = getCartTotal()
    const order = {
      items: cart,
      total: freshTotal,
      orderNumber: Math.floor(Math.random() * 900) + 100,
      customerName: customerName || "Cliente", // Novo campo
    }
    setLastOrder(order)
    // OBS: O carrinho NÃO é limpo aqui.
    // A limpeza ocorre na tela Finish para garantir transição suave.
    return order
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        increase,
        decrease,
        getCartTotal,
        finalizeOrder,
        clearCart, // EXPOSTO AGORA
        lastOrder
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}

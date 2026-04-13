import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import "./index.css"
import { CartProvider } from "./context/CartContext"
import { LoyaltyProvider } from "./context/LoyaltyContext"

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <LoyaltyProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </LoyaltyProvider>
  </BrowserRouter>
)
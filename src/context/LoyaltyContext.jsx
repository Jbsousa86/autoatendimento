import { createContext, useContext, useState } from "react"

const LoyaltyContext = createContext()

export function LoyaltyProvider({ children }) {
  const [currentCustomer, setCurrentCustomer] = useState(null)
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)

  const setCustomerPhone = (phone) => {
    setCurrentCustomer(phone)
  }

  const clearCustomer = () => {
    setCurrentCustomer(null)
    setLoyaltyPoints(0)
  }

  return (
    <LoyaltyContext.Provider
      value={{
        currentCustomer,
        setCustomerPhone,
        clearCustomer,
        loyaltyPoints,
        setLoyaltyPoints
      }}
    >
      {children}
    </LoyaltyContext.Provider>
  )
}

export function useLoyalty() {
  return useContext(LoyaltyContext)
}

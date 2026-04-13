import { useState, useEffect } from "react"
import { Gift, Phone, X } from "lucide-react"
import { loyaltyService } from "../services/api"

export default function LoyaltyModal({ isOpen, onClose, onApplyDiscount }) {
  const [phone, setPhone] = useState("")
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSearchCustomer = async () => {
    if (!phone.trim()) return

    setLoading(true)
    setError("")
    try {
      const data = await loyaltyService.getCustomerByPhone(phone)
      if (data) {
        setCustomer(data)
      } else {
        setError("Cliente não encontrado")
        setCustomer(null)
      }
    } catch (err) {
      setError("Erro ao buscar cliente")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRedeemPoints = async () => {
    if (!customer) return

    setLoading(true)
    try {
      const discount = Math.floor(customer.loyalty_points / 10) // 1 ponto = R$ 0,10
      const result = await loyaltyService.redeemPoints(customer.id, discount)
      
      if (result) {
        onApplyDiscount(discount)
        onClose()
      }
    } catch (err) {
      setError("Erro ao resgatar pontos")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-bold">Programa de Fidelidade</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!customer ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone do Cliente
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="00 99999-9999"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                  <button
                    onClick={handleSearchCustomer}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? "..." : "Buscar"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Telefone</p>
                  <p className="text-lg font-semibold">{customer.phone}</p>
                </div>

                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-gray-600">Pontos Disponíveis</p>
                  <p className="text-3xl font-bold text-red-600">{customer.loyalty_points}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    = R$ {(customer.loyalty_points / 10).toFixed(2)}
                  </p>
                </div>

                {customer.loyalty_points >= 10 ? (
                  <button
                    onClick={handleRedeemPoints}
                    disabled={loading}
                    className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50"
                  >
                    {loading ? "Resgatando..." : "Resgatar Pontos"}
                  </button>
                ) : (
                  <div className="p-3 bg-yellow-100 text-yellow-700 rounded-lg text-sm">
                    Mínimo 10 pontos para resgatar
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t flex gap-2">
          {customer && (
            <button
              onClick={() => {
                setCustomer(null)
                setPhone("")
                setError("")
              }}
              className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Voltar
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

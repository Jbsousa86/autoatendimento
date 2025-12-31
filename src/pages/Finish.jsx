import { useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { useCart } from "../context/CartContext"
import { orderService } from "../services/api"

export default function Finish() {
  const navigate = useNavigate()
  const location = useLocation()
  const { lastOrder, clearCart } = useCart()

  const order = location.state?.order || lastOrder
  const [tempName, setTempName] = useState(order?.customerName || "Cliente")
  const hasProcessed = useRef(false)
  const [isPrinting, setIsPrinting] = useState(false)


  useEffect(() => {
    const processOrder = async () => {
      if (order && !hasProcessed.current) {
        hasProcessed.current = true
        try {
          const saved = await orderService.createOrder(order)
          if (saved && saved.id) order.id = saved.id
          window.dispatchEvent(new CustomEvent('new-order-placed', { detail: order }))
          clearCart()
        } catch (err) {
          console.error("Erro ao salvar pedido:", err)
        }
      }
    }
    processOrder()
    if (order?.customerName) setTempName(order.customerName)


    const handleAfterPrint = () => handleNewOrder()
    window.addEventListener('afterprint', handleAfterPrint)

    const safetyTimer = setTimeout(() => handleNewOrder(), 30000)

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      clearTimeout(safetyTimer)
    }
  }, [order, clearCart])

  const handleUpdateName = async () => {
    if (order?.id) await orderService.updateOrderName(order.id, tempName)
    order.customerName = tempName
  }

  function handleNewOrder() {
    window.location.href = "/"
  }

  const [configClickCount, setConfigClickCount] = useState(0)
  const [showAdminConfig, setShowAdminConfig] = useState(false)

  const handleAdminUnlock = () => {
    const newCount = configClickCount + 1
    if (newCount >= 7) {
      setShowAdminConfig(true)
      setConfigClickCount(0)
    } else {
      setConfigClickCount(newCount)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setConfigClickCount(0), 3000)
    return () => clearTimeout(timer)
  }, [configClickCount])

  if (!order || !order.orderNumber) {
    return (
      <div className="h-screen w-screen bg-red-600 flex flex-col items-center justify-center text-white p-10 text-center">
        <h1 className="text-4xl font-bold mb-4">⚠️ Erro ao carregar pedido</h1>
        <button onClick={handleNewOrder} className="bg-white text-red-600 px-8 py-4 rounded-xl font-bold text-xl">
          Voltar ao Início
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-screen bg-green-600 flex flex-col items-center pt-10 pb-20 text-white overflow-y-auto">
      <h1 onClick={handleAdminUnlock} className="text-5xl font-extrabold mb-6 text-center animate-bounce cursor-default select-none screen-only">
        ✅ SUCESSO!
      </h1>

      <div className="mb-2 text-center w-full max-w-2xl px-6 screen-only">
        <input
          type="text"
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onBlur={handleUpdateName}
          className="w-full bg-transparent text-7xl font-black text-white uppercase text-center focus:outline-none placeholder-white/30 truncate"
          placeholder="Seu Nome"
        />
      </div>

      <div className="text-[180px] leading-none font-black mb-10 drop-shadow-2xl text-yellow-300 screen-only">
        {order.orderNumber}
      </div>

      {order.orderObservation && (
        <div className="mb-10 bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/20 screen-only">
          <p className="text-2xl italic text-white font-medium italic">"{order.orderObservation}"</p>
        </div>
      )}

      <div className="mb-12 screen-only">
        <p className="text-5xl font-black text-white/90">
          {Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>

      <div className="flex flex-col gap-12 w-full max-w-sm px-6 screen-only">
        <button
          onClick={() => {
            window.print()
          }}
          className="w-full py-4 bg-white text-gray-800 text-xl font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 screen-only hover:bg-gray-50 active:scale-95 transition-all"
        >
          <span>🖨️</span>
          IMPRIMIR RECIBO
        </button>




        <button onClick={handleNewOrder} className="w-full py-6 bg-white text-green-600 text-3xl font-black rounded-2xl shadow-2xl hover:scale-[1.02] transition-transform active:scale-95 screen-only">
          NOVO PEDIDO
        </button>
      </div>

      <div id="receipt" className="text-black bg-white font-mono">
        <div className="text-center mb-4">
          <h2 className="text-xl font-black uppercase">Hero's Burger</h2>
          <p className="text-xs italic">CNPJ: 48.507.205/0001-94</p>
          <p className="text-xs">TEL: (63) 99103-8781</p>
        </div>
        <div className="border-b border-black border-dashed my-2"></div>
        <div className="flex justify-between font-bold text-lg my-2">
          <span>PEDIDO:</span>
          <span className="text-2xl">{order.orderNumber}</span>
        </div>
        <div className="font-bold uppercase truncate">CLIENTE: {tempName}</div>
        <div className="text-[10px] mb-2">Data: {new Date().toLocaleString('pt-BR')}</div>
        <div className="border-b border-black border-dashed my-2"></div>
        <table className="w-full text-left font-mono text-[10px]">
          <tbody>
            {order.items?.map((item, i) => (
              <tr key={i} className="border-b border-black border-dashed">
                <td className="py-1 w-6">{item.qty}x</td>
                <td className="py-1">
                  <div>{item.name}</div>
                  {item.observation && <div className="text-[9px] italic">➔ {item.observation}</div>}
                </td>
                <td className="py-1 text-right">{(item.price * item.qty).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-black border-dashed pt-2 my-2 font-bold flex justify-between text-base">
          <span>TOTAL</span>
          <span>{Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        {order.observation && (
          <div className="mt-2 text-[9px] border border-black p-1">
            <strong>OBS:</strong> {order.observation}
          </div>
        )}
        <div className="text-center mt-4 text-[9px]">Obrigado pela preferencia!</div>
      </div>
    </div>
  )
}

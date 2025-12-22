import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useRef } from "react"
import { useCart } from "../context/CartContext"
import { orderService } from "../services/api"

export default function Finish() {
  const navigate = useNavigate()
  const location = useLocation()
  const { lastOrder, clearCart } = useCart()

  // 1. Tenta pegar do state da navegação
  // 2. Tenta pegar do contexto
  // 3. Se não tiver nada, retorna null
  const order = location.state?.order || lastOrder

  // Se chegou aqui com sucesso, limpamos o carrinho do contexto
  // Usamos useRef para garantir que impressao/salvamento ocorra SÓ UMA VEZ
  const hasProcessed = useRef(false)

  useEffect(() => {
    if (order && !hasProcessed.current) {
      hasProcessed.current = true // Marca como processado

      // 1. Dispatch event local para KDS (se mesma janela)
      const event = new CustomEvent('new-order-placed', { detail: order })
      window.dispatchEvent(event)

      // 2. Persistir via API Service (preparado para Backend)
      orderService.createOrder(order)

      clearCart()
    }
  }, [order, clearCart])

  function handleNewOrder() {
    // Force a hard reload to ensure clean state for the new order (Kiosk mode best practice)
    window.location.href = "/"
  }

  // Debug na tela para entender o "Tela Branca"
  if (!order || !order.orderNumber) {
    return (
      <div className="h-screen w-screen bg-red-600 flex flex-col items-center justify-center text-white p-10 text-center">
        <h1 className="text-4xl font-bold mb-4">⚠️ Erro ao carregar pedido</h1>
        <p className="mb-8">Dados não encontrados.</p>

        <button
          onClick={handleNewOrder}
          className="bg-white text-red-600 px-8 py-4 rounded-xl font-bold text-xl"
        >
          Voltar ao Início
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-green-600 flex flex-col items-center justify-center text-white">
      <h1 className="text-6xl font-extrabold mb-10 text-center leading-tight">
        ✅ Pedido Realizado
      </h1>

      <p className="text-3xl mb-4 font-medium opacity-90">
        Número do pedido
      </p>

      <div className="text-9xl font-black mb-2 drop-shadow-md">
        {order.orderNumber}
      </div>
      {order.customerName && order.customerName !== "Cliente" && (
        <p className="text-2xl font-bold text-green-200 mb-10 uppercase tracking-wider">
          {order.customerName}
        </p>
      )}

      <div className="bg-green-700/50 px-10 py-6 rounded-3xl backdrop-blur-sm mb-16 border border-green-500/30">
        <p className="text-sm uppercase tracking-widest font-bold text-green-200 mb-1 text-center">Valor Total</p>
        <p className="text-5xl font-bold text-white">
          {Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>

      <button
        onClick={() => window.print()}
        className="mb-6 px-8 py-4 bg-white text-gray-800 text-xl font-bold rounded-2xl shadow-lg hover:bg-gray-50 flex items-center gap-2 screen-only"
      >
        <span>🖨️</span> IMPRIMIR RECIBO
      </button>

      <button
        onClick={handleNewOrder}
        className="w-96 h-24 bg-white text-green-600 text-3xl font-black rounded-3xl shadow-2xl hover:scale-105 transition-transform active:scale-95 screen-only"
      >
        NOVO PEDIDO
      </button>

      {/* COMPROVANTE DE IMPRESSÃO (Escondido na tela, visível na impressão) */}
      <div id="receipt" className="hidden p-4 max-w-[80mm] mx-auto text-black bg-white font-mono text-sm leading-tight">
        <div className="text-center mb-4">
          <h2 className="text-xl font-black uppercase">Lanchonete</h2>
          <p className="text-xs">Rua Exemplo, 123</p>
          <p className="text-xs">CNPJ: 00.000.000/0001-00</p>
        </div>

        <div className="border-b border-black border-dashed my-2"></div>

        <div className="flex justify-between font-bold text-lg my-2">
          <span>PEDIDO:</span>
          <span className="text-2xl">{order.orderNumber}</span>
        </div>

        {order.customerName && (
          <div className="mb-2 font-bold uppercase truncate">
            CLIENTE: {order.customerName}
          </div>
        )}

        <div className="text-xs mb-2">
          Data: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}
        </div>

        <div className="border-b border-black border-dashed my-2"></div>

        <table className="w-full text-left mb-4">
          <thead>
            <tr className="text-xs border-b border-dashed border-black">
              <th className="py-1">Qtd</th>
              <th className="py-1">Item</th>
              <th className="py-1 text-right">Vl.</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, i) => (
              <tr key={i}>
                <td className="py-1 align-top w-8">{item.qty}x</td>
                <td className="py-1 align-top">{item.name}</td>
                <td className="py-1 align-top text-right">
                  {(Number(item.price) * (item.qty || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-black border-dashed pt-2 my-2">
          <div className="flex justify-between font-bold text-lg">
            <span>TOTAL</span>
            <span>{Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>

        <div className="text-center mt-6 text-xs">
          <p>Obrigado pela preferência!</p>
          <p>Aguarde chamarmos sua senha.</p>
        </div>
      </div>
    </div>
  )
}

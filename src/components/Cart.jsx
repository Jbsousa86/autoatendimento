import { useCart } from "../context/CartContext"
import { useNavigate } from "react-router-dom"

export function Cart() {
  const { cart, finalizeOrder, increase, decrease } = useCart()
  const navigate = useNavigate()

  // FORCE CALCULATION INLINE
  // Using a new variable name 'finalTotal' to prevent any shadowing.
  let finalTotal = 0
  cart.forEach(item => {
    finalTotal += (Number(item.price) * (Number(item.qty) || 0))
  })

  return (
    <aside className="w-1/4 bg-white border-l border-gray-200 flex flex-col h-full shadow-2xl z-50">
      <div className="p-6 bg-gray-50 border-b border-gray-200">
        <h2 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
          🛒 <span className="tracking-tight">Seu Pedido</span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32"> {/* Mais padding bottom para garantir scroll */}
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-4">
            <p className="text-8xl">🍔</p>
            <p className="text-xl font-medium text-center px-6">
              Selecione produtos ao lado para começar
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              // FORCE RE-RENDER ON QTY CHANGE to avoid stale DOM visual bugs
              key={`${item.id}-${item.qty}`}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Nome e Preço Unitário */}
              <div className="flex justify-between items-start mb-3 pb-2 border-b border-gray-100">
                <span className="font-bold text-lg text-gray-800 leading-tight w-2/3">
                  {item.name}
                </span>
                <div className="text-right">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unitário</span>
                  <span className="text-sm font-semibold text-gray-500">
                    {Number(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              {/* Controles e Total do Item */}
              <div className="flex justify-between items-center mt-2">

                {/* Quantidade */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-3">
                  <button
                    onClick={() => decrease(item.id)}
                    className="w-10 h-10 flex items-center justify-center bg-white text-red-500 rounded-md shadow-sm border border-gray-200 font-bold hover:bg-red-50 active:scale-95 transition-all text-xl leading-none pb-1"
                  >
                    -
                  </button>
                  <span className="font-black text-gray-800 text-xl w-6 text-center">
                    {item.qty}
                  </span>
                  <button
                    onClick={() => increase(item.id)}
                    className="w-10 h-10 flex items-center justify-center bg-white text-green-600 rounded-md shadow-sm border border-gray-200 font-bold hover:bg-green-50 active:scale-95 transition-all text-xl leading-none pb-1"
                  >
                    +
                  </button>
                </div>

                {/* Total do Item - DESTACADO */}
                <div className="text-right">
                  <span className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total</span>
                  <span className="text-2xl font-black text-gray-900">
                    {(Number(item.price) * item.qty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Fixo com Z-Index altíssimo */}
      <div className="bg-white border-t-2 border-gray-200 p-6 shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.1)] z-[100] relative">
        <div className="flex justify-between items-end mb-6">
          <span className="text-gray-600 font-bold text-xl mb-1">Total a pagar:</span>
          <div className="text-right">
            <span className="text-5xl font-black text-black-600 tracking-tighter drop-shadow-sm">
              {finalTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            const order = finalizeOrder()
            navigate("/finish", { state: { order } })
          }}
          disabled={cart.length === 0}
          className="w-full h-24 bg-black text-white text-2xl font-black rounded-2xl disabled:bg-gray-300 disabled:text-gray-500 hover:bg-gray-800 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl flex items-center justify-center gap-3"
        >
          {cart.length === 0 ? (
            "CARRINHO VAZIO"
          ) : (
            <>
              <span>✅</span> FINALIZAR PEDIDO
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

import { useState } from "react"
import { useCart } from "../context/useCart"
import { useNavigate } from "react-router-dom"
import Logo from "../assets/herosburger.jpg" // Importanto Logo

export function Cart({ customerPhone = "", setCustomerPhone = null }) {
  const { cart, finalizeOrder, increase, decrease, updateObservation } = useCart()
  const [customerName, setCustomerName] = useState("") // Nome do cliente
  const [generalObservation, setGeneralObservation] = useState("") // Obs geral
  const [paymentMethod, setPaymentMethod] = useState("") // Sem default agora, obriga escolher
  const navigate = useNavigate()

  // FORCE CALCULATION INLINE
  // Using a new variable name 'finalTotal' to prevent any shadowing.
  let finalTotal = 0
  cart.forEach(item => {
    finalTotal += (Number(item.price) * (Number(item.qty) || 0))
  })

  return (
    <aside className="w-[28%] xl:w-1/4 shrink-0 bg-white/40 backdrop-blur-3xl border-l border-white/20 flex flex-col h-full shadow-2xl z-50 transition-all overflow-x-hidden">
      <div className="p-4 xl:p-6 bg-transparent border-b border-white/10">
        <h2 className="text-xl xl:text-3xl font-extrabold text-white flex items-center gap-2 xl:gap-3 drop-shadow-md">
          <img
            src={Logo}
            alt="Logo"
            className="w-10 h-10 xl:w-12 xl:h-12 rounded-full object-cover border-2 border-white/50 shadow-sm shrink-0"
          />
          <span className="tracking-tight truncate">Seu Pedido</span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 xl:p-4 space-y-4 pb-32"> {/* Mais padding bottom para garantir scroll */}
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/60 space-y-4 animate-pulse">
            <p className="text-8xl drop-shadow-lg">🍔</p>
            <p className="text-xl font-bold text-center px-6 drop-shadow-md">
              Seu carrinho está vazio
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              // CARTÃO FLUTUANTE (Floating Card Style)
                  key={item.id}
              className="bg-white/95 backdrop-blur-md rounded-2xl p-3 xl:p-4 shadow-2xl hover:scale-[1.01] transition-all outline outline-2 outline-transparent hover:outline-orange-400 group"
            >
              {/* Nome e Preço Unitário */}
              <div className="flex justify-between items-start gap-2 mb-3 pb-2 border-b border-gray-100">
                <span className="font-bold text-sm xl:text-lg text-gray-800 leading-tight flex-1 min-w-0 break-words">
                  {item.name}
                </span>
                <div className="text-right shrink-0">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unitário</span>
                  <span className="text-xs xl:text-sm font-semibold text-gray-500 whitespace-nowrap">
                    {Number(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              {/* Controles e Total do Item */}
              <div className="flex flex-wrap justify-between items-center gap-2 mt-2 mb-3">

                {/* Quantidade */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1.5 xl:gap-3 shrink-0">
                  <button
                    onClick={() => decrease(item.id)}
                    className="w-8 h-8 xl:w-10 xl:h-10 flex items-center justify-center bg-white text-red-500 rounded-md shadow-sm border border-gray-200 font-bold hover:bg-red-50 active:scale-95 transition-all text-lg xl:text-xl leading-none pb-1"
                  >
                    -
                  </button>
                  <span className="font-black text-gray-800 text-base xl:text-xl w-5 xl:w-6 text-center">
                    {item.qty}
                  </span>
                  <button
                    onClick={() => increase(item.id)}
                    className="w-8 h-8 xl:w-10 xl:h-10 flex items-center justify-center bg-white text-green-600 rounded-md shadow-sm border border-gray-200 font-bold hover:bg-green-50 active:scale-95 transition-all text-lg xl:text-xl leading-none pb-1"
                  >
                    +
                  </button>
                </div>

                {/* Total do Item - DESTACADO */}
                <div className="text-right ml-auto shrink-0">
                  <span className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total</span>
                  <span className="text-lg xl:text-2xl font-black text-gray-900 whitespace-nowrap">
                    {(Number(item.price) * item.qty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              {/* OBSERVAÇÃO DO ITEM - BOTÃO + CAMPO */}
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Observação</span>
                  <div className="h-[1px] flex-1 bg-gray-100"></div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: Sem cebola, bem passado..."
                    className="w-full bg-gray-50 border-2 border-transparent rounded-xl p-2.5 xl:p-3 pl-9 xl:pl-10 text-xs xl:text-sm font-bold text-gray-700 placeholder-gray-300 focus:outline-none focus:border-orange-400 focus:bg-white transition-all shadow-inner"
                    value={item.observation || ""}
                    onChange={(e) => updateObservation(item.id, e.target.value)}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📝</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Fixo (Glass Effect mais forte) */}
      <div className="bg-white/40 backdrop-blur-xl border-t border-white/20 p-4 xl:p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.2)] z-[100] relative">

        {/* INPUT NOME DO CLIENTE */}
        <div className="mb-3 xl:mb-4">
          <label className="block text-white text-sm font-bold mb-1 ml-1 uppercase text-[10px] tracking-widest drop-shadow-md">Seu Nome (Obrigatório)</label>
          <input
            type="text"
            placeholder="Digite seu nome aqui..."
            className="w-full bg-white/80 border-2 border-white/50 rounded-xl p-2.5 xl:p-3 text-base xl:text-lg font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-orange-400/50 transition-all shadow-lg"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        {/* OBSERVAÇÃO GERAL */}
        <div className="mb-3 xl:mb-4">
          <label className="block text-white text-sm font-bold mb-1 ml-1 uppercase text-[10px] tracking-widest drop-shadow-md">Observação Geral</label>
          <textarea
            placeholder="Ex: Embalar para viagem, molho extra..."
            rows={2}
            className="w-full bg-white/80 border-2 border-white/50 rounded-xl p-2.5 xl:p-3 text-xs xl:text-sm font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-orange-400/50 transition-all shadow-lg resize-none"
            value={generalObservation}
            onChange={(e) => setGeneralObservation(e.target.value)}
          />
        </div>

        {/* TELEFONE PARA FIDELIDADE (OPCIONAL) */}
        {setCustomerPhone && (
          <div className="mb-3 xl:mb-4">
            <label className="block text-white text-sm font-bold mb-1 ml-1 uppercase text-[10px] tracking-widest drop-shadow-md">📱 Telefone (opcional - para pontuar na fidelidade)</label>
            <input
              type="tel"
              placeholder="Seu telefone para acumular pontos..."
              className="w-full bg-white/80 border-2 border-white/50 rounded-xl p-2.5 xl:p-3 text-xs xl:text-sm font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-orange-400/50 transition-all shadow-lg"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
            />
          </div>
        )}

        {/* ESCOLHA DO PAGAMENTO (NOVO) */}
        <div className="mb-4 xl:mb-6">
          <label className="block text-white text-[10px] font-black uppercase tracking-widest mb-2 xl:mb-3 drop-shadow-md">Como deseja pagar?</label>
          <div className="grid grid-cols-3 gap-1.5 xl:gap-2">
            {[
              { id: 'dinheiro', icon: '💵', label: 'Dinheiro' },
              { id: 'cartao', icon: '💳', label: 'Cartão' },
              { id: 'pix', icon: '💎', label: 'Pix' }
            ].map((method) => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                className={`flex flex-col items-center justify-center p-2 xl:p-3 rounded-2xl border-2 transition-all gap-1 ${
                  paymentMethod === method.id 
                  ? 'bg-white border-white text-orange-600 shadow-xl scale-105' 
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
              >
                <span className="text-xl xl:text-2xl">{method.icon}</span>
                <span className="text-[9px] xl:text-[10px] font-black uppercase tracking-tighter">{method.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-baseline gap-2 mb-4 xl:mb-6">
          <span className="text-white font-bold text-base xl:text-xl drop-shadow-md shrink-0">Total a pagar:</span>
          <div className="text-right ml-auto">
            <span className="text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-black text-black tracking-tighter drop-shadow-md whitespace-nowrap">
              {finalTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            if (!customerName.trim() || !paymentMethod) return
            const order = finalizeOrder(customerName, generalObservation, paymentMethod, customerPhone)
            order.origin = 'totem'
            order.created_at_client = Date.now()

            navigate("/finish", { state: { order }, replace: true })
          }}
          disabled={cart.length === 0 || !customerName.trim() || !paymentMethod}
          className="w-full h-20 xl:h-24 bg-black text-white text-2xl xl:text-3xl font-black rounded-3xl disabled:bg-black/30 disabled:text-white/30 hover:bg-gray-900 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-2xl flex items-center justify-center flex-col gap-1 border-4 border-white/20"
        >
          {cart.length === 0 ? (
            "CARRINHO VAZIO"
          ) : !customerName.trim() ? (
            <span className="text-lg xl:text-xl uppercase">Digite seu nome</span>
          ) : !paymentMethod ? (
            <span className="text-lg xl:text-xl uppercase">Escolha o pagamento</span>
          ) : (
            <>
              <span className="text-3xl xl:text-4xl">✅</span>
              <span className="leading-none">FINALIZAR</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

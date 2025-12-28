import { useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
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

  // Estado local para o nome editável no recibo
  const [tempName, setTempName] = useState(order?.customerName || "Cliente")
  const hasProcessed = useRef(false)
  const [usbPrinter, setUsbPrinter] = useState(null)

  const connectUSB = async () => {
    try {
      const device = await navigator.usb.requestDevice({ filters: [] })
      await device.open()
      await device.selectConfiguration(1)
      await device.claimInterface(device.configuration.interfaces[0].interfaceNumber)
      setUsbPrinter(device)
      alert("✅ Impressora Epson (USB) conectada!")
    } catch (err) {
      console.error("Erro USB:", err)
      alert("❌ Erro ao conectar impressora via cabo.")
    }
  }

  const printUSB = async () => {
    if (!usbPrinter || !order) return false
    try {
      const encoder = new TextEncoder()
      const txt = (str) => encoder.encode(str + '\n')

      const INIT = new Uint8Array([0x1B, 0x40])
      const CENTER = new Uint8Array([0x1B, 0x61, 0x01])
      const LEFT = new Uint8Array([0x1B, 0x61, 0x00])
      const BOLD_ON = new Uint8Array([0x1B, 0x45, 0x01])
      const BOLD_OFF = new Uint8Array([0x1B, 0x45, 0x00])
      const DOUBLE_ON = new Uint8Array([0x1B, 0x21, 0x30])
      const DOUBLE_OFF = new Uint8Array([0x1B, 0x21, 0x01])
      const FEED = new Uint8Array([0x1D, 0x56, 0x41, 0x03])

      let data = new Uint8Array([
        ...INIT, ...CENTER, ...BOLD_ON, ...DOUBLE_ON, ...txt("HEROS BURGER"), ...DOUBLE_OFF,
        ...txt("Autoatendimento"), ...BOLD_OFF,
        ...txt("--------------------------------"),
        ...BOLD_ON, ...txt(`PEDIDO: ${order.orderNumber}`), ...BOLD_OFF,
        ...LEFT, ...txt(`Cliente: ${tempName}`),
        ...txt(`Data: ${new Date().toLocaleString()}`),
        ...txt("--------------------------------"),
      ])

      order.items.forEach(item => {
        const line = `${item.qty}x ${item.name.slice(0, 18)}`.padEnd(20) + ` R$${(item.price * item.qty).toFixed(2)}`
        data = new Uint8Array([...data, ...txt(line)])
        if (item.observation) data = new Uint8Array([...data, ...txt(`  > ${item.observation}`)])
      })

      data = new Uint8Array([
        ...data,
        ...txt("--------------------------------"),
        ...BOLD_ON, ...txt(`TOTAL: R$ ${Number(order.total).toFixed(2)}`), ...BOLD_OFF,
        ...CENTER, ...txt("\nAcompanhe sua senha no painel!"), ...FEED
      ])

      // Epson geralmente usa o endpoint 1 para saída
      const endpoint = usbPrinter.configuration.interfaces[0].alternates[0].endpoints.find(e => e.direction === 'out').endpointNumber
      await usbPrinter.transferOut(endpoint, data)
      return true
    } catch (err) {
      console.error("Erro na impressão USB:", err)
      return false
    }
  }

  useEffect(() => {
    const processOrder = async () => {
      if (order && !hasProcessed.current) {
        hasProcessed.current = true
        try {
          // Salva no banco
          const saved = await orderService.createOrder(order)
          // Se o banco retornou ID (via select() que adicionaremos de volta na API), guardamos
          if (saved && saved.id) {
            order.id = saved.id
          }

          // Evento local para KDS
          window.dispatchEvent(new CustomEvent('new-order-placed', { detail: order }))

          // Limpa carrinho global
          clearCart()
        } catch (err) {
          console.error("Erro ao salvar pedido:", err)
        }
      }
    }
    processOrder()
    if (order?.customerName) setTempName(order.customerName)

    // 🕒 AUTOMATED RETURN LOGIC (Para o Totem)

    // 1. Após fechar o diálogo de impressão (Nativo)
    const handleAfterPrint = () => handleNewOrder()
    window.addEventListener('afterprint', handleAfterPrint)

    // 2. Timer de segurança: Se o cliente esquecer a tela aberta, volta em 30 seg
    const safetyTimer = setTimeout(() => {
      handleNewOrder()
    }, 30000)

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      clearTimeout(safetyTimer)
    }
  }, [order, clearCart])

  const handleUpdateName = async () => {
    if (order?.id) {
      await orderService.updateOrderName(order.id, tempName)
    }
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

  // Reset do contador após 3 segundos sem cliques
  useEffect(() => {
    const timer = setTimeout(() => setConfigClickCount(0), 3000)
    return () => clearTimeout(timer)
  }, [configClickCount])

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
    <div className="min-h-screen w-screen bg-green-600 flex flex-col items-center pt-10 pb-20 text-white overflow-y-auto">
      <h1
        onClick={handleAdminUnlock}
        className="text-5xl font-extrabold mb-6 text-center animate-bounce cursor-default select-none"
      >
        ✅ SUCESSO!
      </h1>

      {/* NOME DO CLIENTE EM DESTAQUE */}
      <div className="mb-2 text-center w-full max-w-2xl px-6">
        <input
          type="text"
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onBlur={handleUpdateName}
          className="w-full bg-transparent text-7xl font-black text-white uppercase text-center focus:outline-none placeholder-white/30 truncate"
          placeholder="Seu Nome"
        />
      </div>

      <div className="text-[180px] leading-none font-black mb-10 drop-shadow-2xl text-yellow-300">
        {order.orderNumber}
      </div>

      {order.orderObservation && (
        <div className="mb-10 bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/20">
          <p className="text-2xl italic text-white font-medium">
            "{order.orderObservation}"
          </p>
        </div>
      )}

      <div className="mb-12">
        <p className="text-5xl font-black text-white/90">
          {Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm px-6">
        <button
          onClick={async () => {
            const usbSuccess = await printUSB()
            // Se imprimiu via USB com sucesso, já podemos voltar
            if (usbSuccess) {
              handleNewOrder()
            } else {
              // Se falhou USB ou não tem USB, usa o nativo (o afterprint cuidará do retorno)
              window.print()
            }
          }}
          className="w-full py-4 bg-white text-gray-800 text-xl font-bold rounded-2xl shadow-lg hover:bg-gray-50 flex items-center justify-center gap-2 screen-only"
        >
          <span>🖨️</span> {usbPrinter ? 'IMPRIMIR (USB)' : 'IMPRIMIR RECIBO'}
        </button>

        {showAdminConfig && (
          <button
            onClick={connectUSB}
            className={`w-full py-2 text-white text-[10px] font-black rounded-xl border border-white/20 transition-all screen-only ${usbPrinter ? 'bg-blue-600/50 hover:bg-blue-600' : 'bg-green-700/50 hover:bg-green-700 font-bold'
              }`}
          >
            {usbPrinter ? '✅ RECONFIGURAR IMPRESSORA USB' : '🔗 CONECTAR IMPRESSORA USB (CABO)'}
          </button>
        )}

        <button
          onClick={handleNewOrder}
          className="w-full py-6 bg-white text-green-600 text-3xl font-black rounded-2xl shadow-2xl hover:scale-[1.02] transition-transform active:scale-95 screen-only"
        >
          NOVO PEDIDO
        </button>
      </div>

      {/* COMPROVANTE DE IMPRESSÃO (Escondido na tela) */}
      <div id="receipt" className="hidden p-4 max-w-[80mm] mx-auto text-black bg-white font-mono text-sm leading-tight">
        <div className="text-center mb-4">
          <h2 className="text-xl font-black uppercase">Heros Burger</h2>
          <p className="text-xs">Rua Antonio moreira, 123</p>
        </div>
        <div className="border-b border-black border-dashed my-2"></div>
        <div className="flex justify-between font-bold text-lg my-2">
          <span>PEDIDO:</span>
          <span className="text-2xl">{order.orderNumber}</span>
        </div>
        <div className="font-bold uppercase truncate">
          CLIENTE: {tempName}
        </div>
        <div className="text-xs mb-2">
          Data: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}
        </div>
        <div className="border-b border-black border-dashed my-2"></div>
        <table className="w-full text-left">
          <tbody>
            {order.items?.map((item, i) => (
              <tr key={i} className="border-b border-black border-dashed">
                <td className="py-1 w-6">{item.qty}x</td>
                <td className="py-1">
                  <div>{item.name}</div>
                  {item.observation && <div className="text-[10px] italic">➔ {item.observation}</div>}
                </td>
                <td className="py-1 text-right">{(item.price * item.qty).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-black border-dashed pt-2 my-2 font-bold flex justify-between">
          <span>TOTAL</span>
          <span>{Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        {order.observation && (
          <div className="mt-2 text-[10px] border border-black p-1">
            <strong>OBS:</strong> {order.observation}
          </div>
        )}
        <div className="text-center mt-4 text-[10px]">
          Obrigado e volte sempre!
        </div>
      </div>
    </div>
  )
}

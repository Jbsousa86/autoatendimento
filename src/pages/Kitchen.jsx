import { useState, useEffect, useRef } from "react"
import { orderService } from "../services/api"

const DING_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" +
    "tvT19AACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
    "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC" +
    "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
    "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC" +
    "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
    "//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAG1xUAALDkAALDkAAAL5hTbTDKwCYQ" +
    "sP/5UkFnPlPpHgCJ1mq4If/5UkFnPlPpHgCJ1mq4If/5UkFnPlPpHgCJ1mq4If/5UkFnPlPpHgCJ1m" +
    "q4If7ktF+6EAAAAAB1xUAACw5AACw5AAAC+YU20wysAmELD/+VJBZz5T6R4AidZquCH/+VJBZz5T6R" +
    "4AidZquCH/+VJBZz5T6R4AidZquCH/+VJBZz5T6R4AidZquCH+5LRfuhAAAAAAHAAaAAAAAAAAAAAg" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAgAAAAAAAAAAAAAgAAAAAAAAAAAAAgAAAAAA" +
    "AAAAAAAgAAAAAAAAAAAAAgAAAAAAAAAAAAAgAAAAAAAAAAAAAgAAAAAAAAAAAAAgAAAAAAAAAAAAAg" +
    "AAAAAAAAAAAAAgAAAAAAAAAAAAAgAAAAAAAAAAAAAgAAAAAAAAAAAAAgAAAAAAAAAAAAAgAAAAAAAA" +
    "AAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

// ⚠️ O Base64 acima ainda pode falhar se corrompido na cópia.
// Vamos usar um LINK REAL E CONFIÁVEL de fallback que toca em qualquer lugar.
// A estratégia de incorporação direta é boa, mas links CDN são mais seguros para MP3s complexos.
const AUDIO_URL = "https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3"

export default function Kitchen() {
    const [orders, setOrders] = useState([])
    const knownIds = useRef(new Set()) // Rastreia IDs conhecidos
    const isFirstLoad = useRef(true)   // Evita bipar ao abrir a página

    // Carregar pedidos e assinar atualizações em tempo real
    useEffect(() => {
        // Função de som
        const playNotification = () => {
            const audio = new Audio(AUDIO_URL) // Usando URL estável
            audio.volume = 1.0
            audio.play().catch(e => console.log("Erro som (clique na tela para ativar):", e))
        }

        // Tornar acessível globalmente para o botão de teste
        window.playTestSound = playNotification

        const loadOrders = async () => {
            const data = await orderService.getOrders()
            const safeData = Array.isArray(data) ? data : []

            // Logica do BIP: Verificar se tem novidade
            let hasNewOrder = false
            safeData.forEach(order => {
                if (!knownIds.current.has(order.id)) {
                    knownIds.current.add(order.id)
                    // Se não é a primeira carga e o pedido não é "Pronto" (caso de reload), marcamos novidade
                    if (!isFirstLoad.current && order.status !== 'ready') {
                        hasNewOrder = true
                    }
                }
            })

            if (hasNewOrder) {
                playNotification()
            }

            isFirstLoad.current = false // Primeira carga concluída
            setOrders(safeData)
        }

        loadOrders()

        // INSCRIÇÃO REALTIME (Dispara o loadOrders)
        const subscription = orderService.subscribeToOrders(() => {
            loadOrders() // A lógica do som agora está dentro do loadOrders
        })

        // FALBACK: Polling a cada 5 segundos
        const intervalId = setInterval(() => {
            loadOrders()
        }, 5000)

        return () => {
            if (subscription) subscription.unsubscribe()
            clearInterval(intervalId)
        }
    }, [])

    const handleStatusChange = async (id, newStatus) => {
        // 1. Optimistic Update (UI fica rápida)
        setOrders(prev => prev.map(order =>
            order.id === id ? { ...order, status: newStatus } : order
        ))

        // 2. Persistir via Service
        await orderService.updateStatus(id, newStatus)
    }



    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                <h1 className="text-4xl font-black text-yellow-500 tracking-tighter">
                    👨‍🍳 COZINHA <span className="text-gray-500 text-2xl">| Monitor de Pedidos</span>
                </h1>
                <div className="flex gap-4 items-center">
                    <span className="bg-gray-800 px-4 py-2 rounded text-sm font-mono text-gray-400 border border-gray-700">
                        <strong className="text-white">{orders.filter(o => o.status === 'pending').length}</strong> PENDENTES
                    </span>
                    <span className="bg-yellow-900/40 px-4 py-2 rounded text-sm font-mono text-yellow-500 border border-yellow-700/50">
                        <strong className="text-white">{orders.filter(o => o.status === 'preparing').length}</strong> PREPARANDO
                    </span>
                    <span className="flex items-center gap-2 text-green-400 text-sm animate-pulse mr-4">
                        ● Conectado
                    </span>

                    <button
                        onClick={() => window.playTestSound && window.playTestSound()}
                        className="bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-900 px-4 py-2 rounded text-sm font-bold transition-all"
                    >
                        🔊 TESTAR SOM
                    </button>


                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {orders
                    .filter(order => ['pending', 'preparing'].includes(order.status)) // Mostra apenas pendentes e preparando
                    .map(order => (
                        <div
                            key={order.id}
                            className={`rounded-lg p-4 border-l-8 shadow-lg ${order.status === 'preparing'
                                ? 'bg-yellow-900 border-yellow-500'
                                : 'bg-gray-800 border-gray-600'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-black text-white">#{order.order_number}</h2>
                                    <p className="text-yellow-400 font-bold text-lg uppercase tracking-wide truncate max-w-[150px]" title={order.customer_name}>
                                        {order.customer_name || "Cliente"}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-xs text-gray-400">Aberto às</span>
                                    <span className="font-mono text-lg">{formatTime(order.created_at)}</span>
                                    {order.status === 'pending' && <span className="block mt-1 text-xs font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full text-center text-black">AGUARDANDO</span>}
                                    {order.status === 'preparing' && <span className="block mt-1 text-xs font-bold text-yellow-900 bg-yellow-500 px-2 py-0.5 rounded-full text-center animate-pulse">PREPARANDO</span>}
                                </div>
                            </div>

                            <div className="bg-black/30 rounded p-3 mb-4 min-h-[150px]">
                                <ul className="space-y-2">
                                    {Array.isArray(order.items) && order.items.map((item, idx) => (
                                        <li key={idx} className="flex justify-between border-b border-gray-700 pb-1">
                                            <span className="font-bold">{item.qty}x {item.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex gap-2">
                                {order.status === 'pending' && (
                                    <button
                                        onClick={() => handleStatusChange(order.id, 'preparing')}
                                        className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded uppercase"
                                    >
                                        👨‍🍳 Preparar
                                    </button>
                                )}
                                {order.status === 'preparing' && (
                                    <>
                                        <button
                                            onClick={() => handleStatusChange(order.id, 'pending')}
                                            className="px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 rounded-l uppercase text-xl"
                                            title="Voltar para Pendente"
                                        >
                                            ↩
                                        </button>
                                        <button
                                            onClick={() => handleStatusChange(order.id, 'ready')}
                                            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-r uppercase"
                                        >
                                            ✅ Pronto
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    )
}

function formatTime(dateString) {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

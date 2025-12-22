import { useState, useEffect } from "react"
import { orderService } from "../services/api"

export default function Kitchen() {
    const [orders, setOrders] = useState([])

    // Carregar pedidos e assinar atualizações em tempo real
    useEffect(() => {
        const loadOrders = async () => {
            const data = await orderService.getOrders()
            // Garantir que é um array
            setOrders(Array.isArray(data) ? data : [])
        }

        loadOrders()

        // Função de som
        const playNotification = () => {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') // Som de "Ding"
            audio.play().catch(e => console.log("Erro ao tocar som (interaja com a página primeiro):", e))
        }

        // INSCRIÇÃO REALTIME (O Segredo!)
        const subscription = orderService.subscribeToOrders((payload) => {
            // Sempre que algo mudar no banco, recarregamos a lista
            loadOrders()

            // Se for NOVO PEDIDO, toca o sino! 🔔
            if (payload && payload.eventType === 'INSERT') {
                playNotification()
            }
        })

        return () => {
            // Limpar inscrição ao sair
            if (subscription) subscription.unsubscribe()
        }
    }, [])

    const handleStatusChange = async (orderId, newStatus) => {
        // 1. Optimistic Update (UI fica rápida)
        setOrders(prev => prev.map(order =>
            String(order.order_number) === String(orderId) ? { ...order, status: newStatus } : order
        ))

        // 2. Persistir via Service
        await orderService.updateStatus(String(orderId), newStatus)
    }

    const handleClearAll = async () => {
        if (confirm("⚠️ TEM CERTEZA? Isso apagará TODOS os pedidos do banco de dados (Zerar dia).")) {
            if (confirm("Confirmação final: Deseja realmente zerar o sistema?")) {
                await orderService.deleteAllOrders()
                // Idealmente o realtime atualizaria, mas forçamos para garantir
                setOrders([])
            }
        }
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                <h1 className="text-4xl font-black text-yellow-500 tracking-tighter">
                    👨‍🍳 COZINHA <span className="text-gray-500 text-2xl">| Monitor de Pedidos</span>
                </h1>
                <div className="flex gap-4 items-center">
                    <span className="bg-gray-800 px-4 py-2 rounded text-sm font-mono text-gray-400">
                        {orders.filter(o => o.status === 'pending').length} Pendentes
                    </span>
                    <span className="flex items-center gap-2 text-green-400 text-sm animate-pulse mr-4">
                        ● Conectado
                    </span>

                    <button
                        onClick={handleClearAll}
                        className="bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-200 border border-red-900 px-4 py-2 rounded text-sm font-bold transition-all"
                    >
                        🗑️ ZERAR PEDIDOS
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {orders
                    .filter(order => order.status !== 'ready') // Mostra apenas pendentes e preparando
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
                                    <h2 className="text-2xl font-black">#{order.order_number}</h2>
                                    <p className="text-gray-300 text-sm">{order.customer_name}</p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-xs text-gray-400">Aberto às</span>
                                    <span className="font-mono text-lg">{formatTime(order.created_at)}</span>
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
                                        onClick={() => handleStatusChange(order.order_number, 'preparing')}
                                        className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded uppercase"
                                    >
                                        👨‍🍳 Preparar
                                    </button>
                                )}
                                {order.status === 'preparing' && (
                                    <button
                                        onClick={() => handleStatusChange(order.order_number, 'ready')}
                                        className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded uppercase"
                                    >
                                        ✅ Pronto
                                    </button>
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

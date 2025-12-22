import { useState, useEffect } from "react"
import { orderService } from "../services/api"

export default function Kitchen() {
    const [orders, setOrders] = useState([])

    // Simulating fetching orders (in a real app, this would be a WebSocket or polling)
    useEffect(() => {
        // Load initial orders from Service
        const loadOrders = async () => {
            const data = await orderService.getOrders()
            // Garantir que é um array, caso localStorage esteja corrompido ou API falhe
            setOrders(Array.isArray(data) ? data : [])
        }
        loadOrders()

        // Listener for new orders via LocalStorage (Cross-tab communication)
        const handleStorageChange = (e) => {
            if (e.key === 'kitchenOrders') {
                const newOrders = JSON.parse(e.newValue || '[]')
                setOrders(newOrders)
            }
        }

        // Also support custom event for single-tab testing
        const handleLocalEvent = (event) => {
            const newOrder = event.detail
            setOrders(prev => {
                const exists = prev.find(o => o.orderNumber === newOrder.orderNumber)
                if (exists) return prev

                // For local event, we update UI optimistically.
                // The persistence is handled by the event emitter (Finish.jsx)
                // so we don't double-save here.
                return [...prev, { ...newOrder, status: 'pending', timestamp: new Date() }]
            })
        }

        window.addEventListener('storage', handleStorageChange)
        window.addEventListener('new-order-placed', handleLocalEvent)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('new-order-placed', handleLocalEvent)
        }
    }, [])

    const updateStatus = async (orderId, newStatus) => {
        // 1. Optimistic Update (UI fica rápida)
        setOrders(prev => prev.map(order =>
            order.orderNumber === orderId ? { ...order, status: newStatus } : order
        ))

        // 2. Persistir via Service
        await orderService.updateStatus(orderId, newStatus)
    }

    const clearHistory = () => {
        if (confirm("Limpar todo o histórico de pedidos da cozinha?")) {
            setOrders([])
            localStorage.removeItem('kitchenOrders')
        }
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                <h1 className="text-4xl font-black text-yellow-500 tracking-tighter">
                    👨‍🍳 COZINHA <span className="text-gray-500 text-2xl">| Monitor de Pedidos</span>
                </h1>
                <div className="flex gap-4">
                    <span className="bg-gray-800 px-4 py-2 rounded text-sm font-mono text-gray-400">
                        {orders.filter(o => o.status === 'pending').length} Pendentes
                    </span>
                    <button onClick={clearHistory} className="text-red-400 hover:text-red-300 text-sm underline">
                        Limpar Histórico
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

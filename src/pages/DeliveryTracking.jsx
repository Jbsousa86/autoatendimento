import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Search, Truck } from "lucide-react"
import { orderService } from "../services/api"

const statusLabels = {
    pending: "Aguardando cozinha",
    preparing: "Em preparo",
    ready: "Pronto para entrega",
    finished: "Finalizado",
    archived: "Encerrado"
}

const statusStyles = {
    pending: "bg-gray-700 text-gray-200",
    preparing: "bg-yellow-400/20 text-yellow-200",
    ready: "bg-green-400/20 text-green-200",
    finished: "bg-blue-400/20 text-blue-200",
    archived: "bg-gray-700 text-gray-300"
}

export default function DeliveryTracking() {
    const [orders, setOrders] = useState([])
    const [filter, setFilter] = useState("")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [lastUpdated, setLastUpdated] = useState(null)

    const loadOrders = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true)
        const result = await orderService.getDeliveryOrdersToday()
        if (result.error) {
            setError("Não foi possível carregar os pedidos. Verifique a conexão e tente novamente.")
        } else {
            setOrders(Array.isArray(result.data) ? result.data : [])
            setError("")
            setLastUpdated(new Date())
        }
        if (showLoading) setLoading(false)
    }, [])

    useEffect(() => {
        const initialLoad = window.setTimeout(() => loadOrders(true), 0)
        const interval = window.setInterval(() => loadOrders(), 10000)
        return () => {
            window.clearTimeout(initialLoad)
            window.clearInterval(interval)
        }
    }, [loadOrders])

    const visibleOrders = useMemo(() => {
        const number = filter.replace(/\D/g, "")
        if (!number) return orders
        return orders.filter(order => String(order.order_number).includes(number))
    }, [filter, orders])

    return (
        <main className="min-h-screen bg-[#0a0a0a] px-4 py-8 text-white sm:px-6">
            <div className="mx-auto w-full max-w-4xl">
                <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
                            <Truck size={30} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Entregas de hoje</h1>
                            <p className="mt-1 text-sm text-gray-400">Recibos e status atualizados conforme a cozinha.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => loadOrders(true)}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-gray-200 transition hover:bg-white/10 disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
                    </button>
                </header>

                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={filter}
                            onChange={event => setFilter(event.target.value.replace(/\D/g, ""))}
                            inputMode="numeric"
                            placeholder="Filtrar pelo nº do recibo"
                            aria-label="Filtrar pelo número do recibo"
                            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-orange-400"
                        />
                    </div>
                    <p className="text-xs font-semibold text-gray-500">
                        {lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR")}` : "Atualização automática a cada 10 segundos"}
                    </p>
                </div>

                {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-300">{error}</p>}

                {loading && orders.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">
                        <RefreshCw size={22} className="mx-auto mb-3 animate-spin text-orange-400" />
                        Carregando recibos de hoje...
                    </div>
                ) : visibleOrders.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">
                        {orders.length ? "Nenhum recibo corresponde a esse número." : "Nenhuma entrega encontrada hoje."}
                    </div>
                ) : (
                    <section className="grid gap-3 sm:grid-cols-2">
                        {visibleOrders.map((order, index) => (
                            <article key={`${order.order_number}-${order.created_at}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-orange-300">Recibo</p>
                                        <p className="mt-1 text-4xl font-black tracking-tight">#{order.order_number}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Horário</p>
                    <p className="mt-1 text-xl font-black">{new Date(order.created_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}</p>
                                        <p className="mt-1 text-sm font-bold text-gray-300">R$ {Number(order.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                                <div className="mt-5 border-t border-white/10 pt-4">
                                    <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${statusStyles[order.status] || "bg-gray-700 text-gray-200"}`}>
                                        {statusLabels[order.status] || order.status || "Status indisponível"}
                                    </span>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </div>
        </main>
    )
}

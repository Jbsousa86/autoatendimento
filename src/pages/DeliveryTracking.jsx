import { useCallback, useEffect, useState } from "react"
import { MapPin, Package, Phone, RefreshCw, Search, Truck } from "lucide-react"
import { orderService } from "../services/api"

const steps = [
    { id: "pending", label: "Pedido recebido" },
    { id: "preparing", label: "Em preparo" },
    { id: "ready", label: "Pronto para entrega" },
    { id: "finished", label: "Pedido finalizado" }
]

const statusLabels = {
    pending: "Pedido recebido",
    preparing: "Em preparo",
    ready: "Pronto para entrega",
    finished: "Pedido finalizado",
    archived: "Pedido encerrado"
}

export default function DeliveryTracking() {
    const [orderNumber, setOrderNumber] = useState("")
    const [phoneLast4, setPhoneLast4] = useState("")
    const [searchKey, setSearchKey] = useState(null)
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [lastUpdated, setLastUpdated] = useState(null)

    const refreshOrder = useCallback(async (key, showLoading = false) => {
        if (!key) return
        if (showLoading) setLoading(true)
        const result = await orderService.trackDeliveryOrder(key.orderNumber, key.phoneLast4)
        if (result.error) {
            setError("Não foi possível consultar agora. Verifique a conexão e tente novamente.")
        } else if (!result.data) {
            setOrder(null)
            setError("Pedido não encontrado. Confira o número e os últimos quatro dígitos do telefone.")
        } else {
            setOrder(result.data)
            setError("")
            setLastUpdated(new Date())
        }
        if (showLoading) setLoading(false)
    }, [])

    useEffect(() => {
        if (!searchKey) return undefined
        const interval = window.setInterval(() => refreshOrder(searchKey), 10000)
        return () => window.clearInterval(interval)
    }, [searchKey, refreshOrder])

    const handleSubmit = (event) => {
        event.preventDefault()
        const normalizedNumber = orderNumber.trim()
        const normalizedPhone = phoneLast4.replace(/\D/g, "").slice(-4)
        if (!normalizedNumber || normalizedPhone.length !== 4) {
            setError("Informe o número do pedido e os últimos quatro dígitos do telefone.")
            return
        }
        setOrder(null)
        setError("")
        const key = { orderNumber: normalizedNumber, phoneLast4: normalizedPhone }
        setSearchKey(key)
        refreshOrder(key, true)
    }

    const currentStep = steps.findIndex(step => step.id === order?.status)
    const mapUrl = order?.customer_address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`
        : ""

    return (
        <main className="min-h-screen bg-[#0a0a0a] px-4 py-10 text-white">
            <div className="mx-auto w-full max-w-xl">
                <header className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
                        <Truck size={34} />
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight">Acompanhar entrega</h1>
                    <p className="mt-2 text-sm text-gray-400">Consulte o andamento pelo número do pedido.</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                        Número do pedido
                        <input
                            value={orderNumber}
                            onChange={event => setOrderNumber(event.target.value.replace(/\D/g, ""))}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="Ex.: 123"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-lg text-white outline-none focus:border-orange-400"
                        />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                        Últimos 4 dígitos do telefone do pedido
                        <input
                            value={phoneLast4}
                            onChange={event => setPhoneLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={4}
                            placeholder="Ex.: 5678"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-lg tracking-[0.3em] text-white outline-none focus:border-orange-400"
                        />
                    </label>
                    <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-black uppercase tracking-wide text-black transition hover:bg-orange-400 disabled:opacity-60">
                        {loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                        {loading ? "Consultando..." : "Acompanhar pedido"}
                    </button>
                    {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
                </form>

                {order && (
                    <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-xl">
                        <div className="border-b border-white/10 p-5">
                            <p className="text-xs font-bold uppercase tracking-widest text-orange-300">Pedido #{order.order_number}</p>
                            <h2 className="mt-1 text-2xl font-black">{statusLabels[order.status] || order.status}</h2>
                            {lastUpdated && <p className="mt-2 text-xs text-gray-500">Atualizado às {lastUpdated.toLocaleTimeString("pt-BR")}</p>}
                        </div>

                        <ol className="space-y-4 p-5">
                            {steps.map((step, index) => {
                                const done = currentStep >= index
                                return (
                                    <li key={step.id} className={`flex items-center gap-3 text-sm font-bold ${done ? "text-white" : "text-gray-600"}`}>
                                        <span className={`h-3 w-3 rounded-full ${done ? "bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : "bg-gray-700"}`} />
                                        {step.label}
                                    </li>
                                )
                            })}
                        </ol>

                        {order.customer_address && (
                            <div className="border-t border-white/10 p-5">
                                <div className="flex items-start gap-3">
                                    <MapPin size={18} className="mt-0.5 shrink-0 text-orange-300" />
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Endereço de entrega</p>
                                        <p className="mt-1 text-sm font-semibold">{order.customer_address}</p>
                                        <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-orange-300 hover:text-orange-200">
                                            <MapPin size={15} /> Abrir no mapa
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {order.customer_phone && (
                            <div className="border-t border-white/10 px-5 py-4 text-sm text-gray-300">
                                <Phone size={15} className="mr-2 inline text-orange-300" /> Contato: {order.customer_phone}
                            </div>
                        )}

                        {Array.isArray(order.items) && order.items.length > 0 && (
                            <div className="border-t border-white/10 p-5">
                                <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400"><Package size={15} /> Itens</h3>
                                <ul className="space-y-2 text-sm">
                                    {order.items.map((item, index) => <li key={`${item.name}-${index}`}>{item.qty}x {item.name}</li>)}
                                </ul>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </main>
    )
}

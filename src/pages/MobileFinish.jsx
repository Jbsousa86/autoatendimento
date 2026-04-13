import { useNavigate, useLocation, useParams } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { CheckCircle, ArrowLeft, Home, ShoppingBag } from "lucide-react"
import { useCart } from "../context/useCart"
import { orderService } from "../services/api"

export default function MobileFinish() {
    const navigate = useNavigate()
    const location = useLocation()
    const { tableId } = useParams()
    const { clearCart } = useCart() // Import clearCart
    const order = location.state?.order
    const hasProcessed = useRef(false)
    const [retryVisible, setRetryVisible] = useState(false)

    useEffect(() => {
        const processOrder = async () => {
            if (order && !hasProcessed.current) {
                // Check se é um pedido muito antigo/fantasma (> 5 min)
                const isGhost = !order.created_at_client || (Date.now() - order.created_at_client > 5 * 60 * 1000);
                if (isGhost) {
                    console.log("Pedido da mesa bloqueado por ser de uma aba expirada/fantasma.");
                    hasProcessed.current = true;
                    return;
                }

                // Previne duplicata em refresh
                if (sessionStorage.getItem(`processed_order_${order.orderNumber}`)) {
                    console.log("Mesa order already processed, skipping.")
                    hasProcessed.current = true
                    return
                }
                hasProcessed.current = true
                try {
                    console.log("Saving order to DB...", order)
                    const { data: saved, error } = await orderService.createOrder(order)

                    if (error) {
                        console.error("Erro ao salvar pedido da mesa:", error)
                        setRetryVisible(true)
                        return
                    }

                    if (saved) {
                        console.log("Order saved successfully!")
                        // Dispara evento para atualização imediata se estiver no mesmo navegador
                        window.dispatchEvent(new CustomEvent('new-order-placed', { detail: order }))
                        // Marca como processado
                        sessionStorage.setItem(`processed_order_${order.orderNumber}`, "true")

                        // Redireciona automaticamente após 3 segundos
                        setTimeout(() => {
                            if (tableId) navigate(`/mesa/${tableId}`, { replace: true })
                        }, 3000)
                    }
                } catch (err) {
                    console.error("Erro crítico ao salvar pedido:", err)
                }
            }
        }
        processOrder()
    }, [order, clearCart, navigate, tableId])

    const handleNewOrder = () => {
        if (tableId) {
            navigate(`/mesa/${tableId}`, { replace: true })
        } else {
            navigate("/", { replace: true })
        }
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-2xl font-black text-gray-900 mb-4">Pedido não encontrado</h1>
                <button
                    onClick={() => navigate("/")}
                    className="bg-black text-white px-8 py-3 rounded-2xl font-black uppercase"
                >
                    Voltar ao Início
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="mb-8 animate-in zoom-in duration-500">
                <CheckCircle size={100} strokeWidth={3} className="text-white mx-auto shadow-2xl rounded-full" />
            </div>

            <h1 className="text-4xl font-black mb-2 tracking-tight uppercase">Pedido Enviado!</h1>
            <p className="text-white/80 font-bold mb-10 text-lg">Direto para a nossa cozinha 🍔🔥</p>

            <div className="bg-white/20 backdrop-blur-xl rounded-[40px] p-8 w-full max-w-sm border border-white/20 shadow-2xl mb-12">
                <p className="text-sm font-black uppercase tracking-widest text-white/60 mb-1">Seu Número</p>
                <span className="text-8xl font-black text-yellow-300 drop-shadow-2xl">
                    {order.orderNumber}
                </span>
                <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center text-left">
                    <div>
                        <p className="text-[10px] font-black uppercase text-white/60">Pagamento</p>
                        <p className="font-bold">No Caixa</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-white/60">Total</p>
                        <p className="text-xl font-black">
                            {Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-sm space-y-4">
                <button
                    onClick={handleNewOrder}
                    className="w-full h-16 bg-white text-green-600 rounded-2xl text-xl font-black uppercase shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3"
                >
                    <ShoppingBag size={24} />
                    Fazer outro pedido
                </button>

                {retryVisible && (
                    <div className="bg-red-500/20 border border-red-500/50 p-6 rounded-[32px] animate-in fade-in slide-in-from-top-4 duration-500 w-full">
                       <p className="text-red-100 font-bold mb-4 text-sm uppercase tracking-wide">⚠️ Erro ao enviar pedido</p>
                       <button 
                         onClick={() => window.location.reload()}
                         className="w-full bg-red-600 text-white h-16 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all"
                       >
                         Tentar Novamente
                       </button>
                    </div>
                )}

                <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] pt-4">
                    {retryVisible ? "Ocorreu um erro de conexão" : "Agradecemos a preferência!"}
                </p>
            </div>
        </div>
    )
}

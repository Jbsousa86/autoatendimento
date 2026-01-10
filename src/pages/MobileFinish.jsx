import { useNavigate, useLocation, useParams } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { CheckCircle, ArrowLeft, Home, ShoppingBag } from "lucide-react"
import { useCart } from "../context/CartContext"
import { orderService } from "../services/api"

export default function MobileFinish() {
    const navigate = useNavigate()
    const location = useLocation()
    const { tableId } = useParams()
    const { clearCart } = useCart() // Import clearCart
    const order = location.state?.order
    const hasProcessed = useRef(false)

    useEffect(() => {
        const processOrder = async () => {
            if (order && !hasProcessed.current) {
                hasProcessed.current = true
                try {
                    console.log("Saving order to DB...", order)
                    const { data: saved, error } = await orderService.createOrder(order)

                    if (error) {
                        console.error("Erro ao salvar pedido da mesa:", error)
                        alert("⚠️ Erro ao enviar pedido para a cozinha. Por favor, avise o atendente.")
                        return
                    }

                    if (saved) {
                        console.log("Order saved successfully!")
                        // Dispara evento para atualização imediata se estiver no mesmo navegador
                        window.dispatchEvent(new CustomEvent('new-order-placed', { detail: order }))
                        clearCart()

                        // Redireciona automaticamente após 3 segundos
                        setTimeout(() => {
                            if (tableId) navigate(`/mesa/${tableId}`)
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
            navigate(`/mesa/${tableId}`)
        } else {
            navigate("/")
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

                <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] pt-4">
                    Agradecemos a preferência!
                </p>
            </div>
        </div>
    )
}

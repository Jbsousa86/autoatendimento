import { useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { CheckCircle, ShoppingBag, MessageCircle, ArrowLeft, MapPin, User, Hash } from "lucide-react"
import { useCart } from "../context/CartContext"
import { orderService, configService } from "../services/api"

export default function OnlineFinish() {
    const navigate = useNavigate()
    const location = useLocation()
    const { clearCart } = useCart()
    const order = location.state?.order
    const hasProcessed = useRef(false)
    const [whatsappNumber, setWhatsappNumber] = useState("")

    useEffect(() => {
        const processOrder = async () => {
            if (order && !hasProcessed.current) {
                hasProcessed.current = true
                try {
                    await orderService.createOrder(order)
                    clearCart()
                } catch (err) {
                    console.error("Erro ao salvar pedido:", err)
                }
            }
        }
        processOrder()

        configService.getSettings().then(data => {
            const waConfig = data.find(c => c.key === 'whatsapp')
            if (waConfig) setWhatsappNumber(waConfig.value)
        })

        const timer = setTimeout(() => {
            navigate("/cardapio")
        }, 15000)

        return () => clearTimeout(timer)
    }, [order, clearCart, navigate])

    const handleSendWhatsApp = () => {
        if (!order) return

        const waNum = whatsappNumber.replace(/\D/g, '') || "5563991038781"
        
        let message = `*NOVO PEDIDO - HERO'S BURGER*\n\n`;
        message += `*Cliente:* ${order.customerName}\n`;
        message += `*Endereço:* ${order.customerAddress}\n`;
        message += `*Pedido:* #${order.orderNumber}\n`;
        message += `------------------------------\n`;
        
        order.items.forEach(item => {
            message += `*${item.qty}x* ${item.name}\n`;
            message += `_R$ ${(item.price * item.qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}_\n`;
            if (item.observation) message += `_Obs: ${item.observation}_\n`;
            message += `\n`;
        });
        
        message += `------------------------------\n`;
        if (order.observation) message += `*Obs Geral:* ${order.observation}\n`;
        message += `*TOTAL: R$ ${Number(order.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;
        message += `_Aguardando confirmação!_`;

        const encoded = encodeURIComponent(message)
        window.open(`https://wa.me/${waNum}?text=${encoded}`, '_blank')
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600 rounded-full blur-[120px]" />
                </div>
                <h1 className="text-3xl font-black mb-6 uppercase tracking-tighter">Pedido não encontrado</h1>
                <button
                    onClick={() => navigate("/cardapio")}
                    className="bg-white text-black px-10 py-4 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl active:scale-95 transition-all"
                >
                    Voltar ao Cardápio
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white text-center relative overflow-hidden">
            {/* BACKGROUND DECORATION */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-green-600 rounded-full blur-[150px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-lg animate-in zoom-in duration-700">
                <div className="mb-10 relative">
                    <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 animate-pulse scale-150" />
                    <CheckCircle size={100} strokeWidth={2.5} className="text-green-500 mx-auto relative drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
                </div>

                <h1 className="text-5xl font-black mb-4 tracking-tighter uppercase leading-none">
                    Pedido <span className="text-green-500">Recebido!</span>
                </h1>
                <p className="text-gray-400 font-bold mb-12 text-lg px-8 leading-tight">
                    Para confirmar sua entrega, clique no botão abaixo e envie a mensagem no <span className="text-white">WhatsApp</span>.
                </p>

                {/* ORDER CARD */}
                <div className="bg-white/5 backdrop-blur-3xl rounded-[48px] p-8 w-full border border-white/10 shadow-2xl mb-12 text-left relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <ShoppingBag size={120} />
                    </div>
                    
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className="flex items-center gap-2 text-green-500 mb-1">
                                <Hash size={14} className="font-black" />
                                <span className="text-xs font-black uppercase tracking-[0.2em]">Pedido</span>
                            </div>
                            <span className="text-6xl font-black text-white tracking-tighter">
                                {order.orderNumber}
                            </span>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">Total</p>
                            <p className="text-3xl font-black text-yellow-400 tracking-tight">
                                {Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-400 border border-white/5">
                                <User size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest leading-none mb-1">Cliente</p>
                                <p className="font-bold text-white uppercase text-sm">{order.customerName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-400 border border-white/5">
                                <MapPin size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest leading-none mb-1">Endereço de Entrega</p>
                                <p className="font-bold text-white text-sm line-clamp-1">{order.customerAddress}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <button
                        onClick={handleSendWhatsApp}
                        className="w-full h-24 bg-green-600 text-white rounded-[32px] text-2xl font-black uppercase shadow-[0_20px_50px_rgba(22,163,74,0.3)] active:scale-95 transition-all flex items-center justify-center gap-4 animate-bounce hover:bg-green-500 border-b-8 border-green-800"
                    >
                        <MessageCircle size={36} fill="white" />
                        ENVIAR WHATSAPP
                    </button>

                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] pt-4 animate-pulse">
                        Redirecionando em alguns segundos...
                    </p>
                    
                    <button
                        onClick={() => navigate("/cardapio")}
                        className="flex items-center gap-2 mx-auto text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors pt-2"
                    >
                        <ArrowLeft size={14} /> Fazer outro pedido
                    </button>
                </div>
            </div>
        </div>
    )
}

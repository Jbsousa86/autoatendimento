import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Utensils, Clock, Minus, Plus, X, ShoppingBag, User, Share2 } from "lucide-react"
import { categories } from "../data/menu"
import { productService, configService } from "../services/api"
import Logo from "../assets/herosburger.jpg"
import BurgerHeader from "../assets/burger_header.png"
import { useCart } from "../context/CartContext"

export default function OnlineMenu() {
    const navigate = useNavigate()
    const {
        cart,
        addToCart,
        increase,
        decrease,
        updateObservation,
        getCartTotal,
        finalizeOrder,
        clearCart,
        hfPizza,
        hfSize,
        startHalfPizza,
        cancelHalfPizza
    } = useCart()

    const [selectedCategory, setSelectedCategory] = useState("burgers")
    const [products, setProducts] = useState([])
    const [settingsHours, setSettingsHours] = useState("18:00 — 00:00")
    const [merchantMessage, setMerchantMessage] = useState("")
    const [isMenuOpen, setIsMenuOpen] = useState(true)
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [generalObservation, setGeneralObservation] = useState("")
    const [customerName, setCustomerName] = useState("")
    const [customerAddress, setCustomerAddress] = useState("")
    const [paymentMethod, setPaymentMethod] = useState("")
    const [showConfirmModal, setShowConfirmModal] = useState(false)

    useEffect(() => {
        productService.getProducts().then(data => {
            if (data) setProducts(data)
        })
        configService.getSettings().then(data => {
            if (data && Array.isArray(data)) {
                const hoursConfig = data.find(c => c.key === 'hours')
                const msgConfig = data.find(c => c.key === 'merchant_message')
                if (hoursConfig) setSettingsHours(hoursConfig.value)
                if (msgConfig) setMerchantMessage(msgConfig.value)
                const openConfig = data.find(c => c.key === 'is_open')
                if (openConfig) setIsMenuOpen(openConfig.value === 'true' || openConfig.value === true)
            }
        })
    }, [])

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Hero's Burger - Cardápio Online",
                    text: "Confira nosso cardápio e faça seu pedido!",
                    url: window.location.href,
                })
            } catch (err) {
                console.error("Erro ao compartilhar:", err)
            }
        } else {
            navigator.clipboard.writeText(window.location.href)
            alert("Link copiado!")
        }
    }

    const filteredProducts = (products || []).filter(
        (p) => p.category === selectedCategory
    )

    const handleFinalize = () => {
        if (!customerName.trim()) {
            alert("Por favor, informe seu nome para o pedido.")
            return
        }
        if (!customerAddress.trim()) {
            alert("Por favor, informe seu endereço para a entrega.")
            return
        }
        if (!paymentMethod) {
            alert("Por favor, selecione a forma de pagamento.")
            return
        }
        setShowConfirmModal(false)
        const order = finalizeOrder(customerName, generalObservation)
        // Adiciona o endereço e identifica a origem com a forma escolhida
        order.customerAddress = customerAddress
        order.paymentMethod = `online_${paymentMethod}`
        order.created_at_client = Date.now()
        navigate(`/cardapio/sucesso`, { state: { order }, replace: true })
    }

    const cartCount = (cart || []).reduce((sum, item) => sum + (item.qty || 0), 0)
    const total = typeof getCartTotal === 'function' ? getCartTotal() : 0

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans relative">
            {!isMenuOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-[40px] w-full max-w-sm p-10 relative z-10 shadow-2xl text-center animate-in zoom-in duration-300">
                        <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
                            <Clock size={48} />
                        </div>
                        <h2 className="text-4xl font-black text-white mb-3 uppercase tracking-tighter">Ops! Fechamos</h2>
                        <p className="text-gray-400 font-medium mb-10 leading-relaxed">
                            No momento não estamos aceitando pedidos via cardápio online. 
                            <br/><br/>
                            <span className="text-orange-500 font-black">Horário: {settingsHours}</span>
                        </p>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-[10px] uppercase font-black tracking-widest text-gray-500">
                            Tente novamente mais tarde
                        </div>
                    </div>
                </div>
            )}
            {/* BACKGROUND DECORATION */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-600 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-800 rounded-full blur-[120px]" />
            </div>

            {/* MODAL DE CONFIRMAÇÃO FINAL */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowConfirmModal(false)} />
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-[40px] w-full max-w-sm p-8 relative z-10 shadow-2xl animate-in zoom-in duration-300">
                        <div className="text-center">
                            <div className="w-24 h-24 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-orange-500/20">
                                <ShoppingBag size={48} />
                            </div>
                            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Confirmar Pedido?</h2>
                            <p className="text-gray-400 font-medium mb-8 leading-tight">
                                Seu pedido de <span className="text-yellow-400 font-bold">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> será enviado para finalização no WhatsApp.
                            </p>

                            <div className="space-y-4">
                                <button
                                    onClick={handleFinalize}
                                    className="w-full h-20 bg-green-600 text-white rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-green-900/20 active:scale-95 transition-transform text-lg"
                                >
                                    SIM, FINALIZAR!
                                </button>
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="w-full h-14 bg-white/5 text-gray-500 rounded-[20px] font-bold uppercase text-xs active:scale-95 transition-transform border border-white/5"
                                >
                                    Ainda não, voltar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* HEADER PREMIUM COM FUNDO DE HAMBÚRGUER */}
            <header className="fixed top-0 left-0 right-0 z-50 h-[180px] overflow-hidden border-b border-white/5 bg-[#0a0a0a]">
                {/* BACKGROUND IMAGE COM OVERLAY */}
                <div className="absolute inset-0">
                    <img src={BurgerHeader} alt="Background" className="w-full h-full object-cover scale-110 blur-[1px] opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-black/60 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />
                </div>

                {/* CONTEÚDO DO HEADER */}
                <div className="relative h-full flex flex-col justify-between px-6 py-6 pt-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-orange-600 rounded-full blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
                                <img src={Logo} alt="Logo" className="w-14 h-14 rounded-full border-2 border-orange-500 shadow-2xl relative z-10" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white leading-none tracking-tight drop-shadow-lg uppercase italic">Hero's Burger</h1>
                                <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mt-1 inline-block drop-shadow-md">
                                    Faça seu pedido
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleShare}
                                className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all shadow-lg shadow-black/40"
                                title="Compartilhar"
                            >
                                <Share2 size={18} />
                            </button>
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-green-500 uppercase bg-green-500/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-green-500/20 shadow-lg shadow-black/20">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <span>Aberto</span>
                            </div>
                        </div>
                    </div>

                    {/* MENSAGEM DO LOJISTA INTEGRADA */}
                    {merchantMessage ? (
                        <div className="animate-in slide-in-from-bottom-2 duration-700 delay-300">
                            <div className="inline-block relative">
                                <p className="text-[11px] font-black text-white text-center leading-tight uppercase tracking-[0.15em] relative z-10 opacity-90 italic">
                                    "{merchantMessage}"
                                </p>
                                <div className="absolute bottom-[-4px] left-0 right-0 h-[2px] bg-orange-600 opacity-40 blur-[1px]" />
                            </div>
                        </div>
                    ) : (
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] opacity-40">Hero's Burger — Onde cada mordida é épica</p>
                    )}
                </div>
            </header>

            {/* CATEGORIAS */}
            <nav className="fixed top-[180px] left-0 right-0 z-50 bg-[#0a0a0a] border-b border-white/5 overflow-x-auto no-scrollbar py-5 px-6 flex gap-3 transition-all">
                {(categories || []).map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`whitespace-nowrap px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${selectedCategory === cat.id
                            ? "bg-orange-600 text-white shadow-lg shadow-orange-600/30 scale-105"
                            : "bg-white/10 text-gray-400 border border-white/10 hover:bg-white/20"
                            }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </nav>

            {/* LISTA DE PRODUTOS */}
            <main className="flex-1 mt-[260px] pb-40 px-6 z-10">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                        {categories.find(c => c.id === selectedCategory)?.name || "Menu"}
                    </h2>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{filteredProducts.length} Itens</span>
                </div>

                {hfPizza && (
                    <div className="mb-6 bg-gradient-to-r from-orange-600 to-red-600 text-white p-5 rounded-[24px] shadow-2xl flex justify-between items-center animate-pulse border border-white/20">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🍕</span>
                            <span className="text-sm font-black uppercase tracking-tight">Escolha o 2º Sabor ({hfSize})</span>
                        </div>
                        <button onClick={cancelHalfPizza} className="text-[10px] font-black bg-black/40 px-3 py-1.5 rounded-full uppercase border border-white/10">Sair</button>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6">
                    {filteredProducts.map((p) => {
                        const isPizza = p.category && p.category.toLowerCase().includes('pizza');
                        return (
                            <div key={p.id} className="bg-white/5 backdrop-blur-md rounded-[32px] p-4 border border-white/10 flex gap-4 active:scale-[0.98] transition-all duration-300">
                                <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-white/5 border border-white/5 shadow-inner">
                                    {p.image ? (
                                        <img src={p.image} className="w-full h-full object-cover" alt={p.name} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                                            <Utensils size={32} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col justify-between py-1">
                                    <div>
                                        <h3 className="font-black text-white text-lg leading-tight mb-1">{p.name}</h3>
                                        <p className="text-[11px] text-gray-400 font-medium line-clamp-2 leading-tight">
                                            {p.description}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="font-black text-yellow-400 text-xl tracking-tight">R$ {Number(p.price).toFixed(2)}</span>

                                        {!isPizza ? (
                                            <button
                                                onClick={() => addToCart(p)}
                                                className="bg-white text-black h-10 px-5 rounded-xl flex items-center justify-center gap-2 active:bg-orange-600 active:text-white transition-all font-black uppercase text-[10px] tracking-widest shadow-lg"
                                            >
                                                <Plus size={16} />
                                                Add
                                            </button>
                                        ) : hfPizza ? (
                                            <button
                                                onClick={() => addToCart(p)}
                                                className="bg-yellow-400 text-black h-12 px-6 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all font-black uppercase text-xs tracking-widest shadow-xl animate-pulse border-b-4 border-yellow-600"
                                            >
                                                <Plus size={20} />
                                                Sabor 2
                                            </button>
                                        ) : (
                                            <div className="flex flex-col gap-2 w-full mt-1">
                                                {/* Tamanhos Inteiros */}
                                                <div className="grid grid-cols-3 gap-1.5 w-full">
                                                    <button
                                                        onClick={() => {
                                                            cancelHalfPizza();
                                                            addToCart({ ...p, id: `${p.id}-P`, name: `${p.name} (P)`, price: Number(p.price_p || (Number(p.price) * 0.8)) });
                                                        }}
                                                        className="bg-white/10 text-white h-11 rounded-xl flex items-center justify-center font-black text-sm border border-white/5 active:bg-white/20 transition-all shadow-md"
                                                    >P</button>
                                                    <button
                                                        onClick={() => {
                                                            cancelHalfPizza();
                                                            addToCart({ ...p, id: `${p.id}-M`, name: `${p.name} (M)`, price: Number(p.price) });
                                                        }}
                                                        className="bg-white/10 text-white h-11 rounded-xl flex items-center justify-center font-black text-sm border border-white/5 active:bg-white/20 transition-all shadow-md"
                                                    >M</button>
                                                    <button
                                                        onClick={() => {
                                                            cancelHalfPizza();
                                                            const gPrice = Number(p.price_g || (Number(p.price) * 1.2));
                                                            addToCart({ ...p, id: `${p.id}-G`, name: `${p.name} (G)`, price: gPrice });
                                                        }}
                                                        className="bg-white/10 text-white h-11 rounded-xl flex items-center justify-center font-black text-sm border border-white/5 active:bg-white/20 transition-all shadow-md"
                                                    >G</button>
                                                </div>
                                                {/* Metade-a-Metade */}
                                                <div className="grid grid-cols-2 gap-1.5 w-full">
                                                    <button
                                                        onClick={() => startHalfPizza(p, 'M')}
                                                        className="bg-orange-600/80 text-white h-9 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-md shadow-orange-600/20 active:bg-orange-700 transition-all tracking-wider border border-orange-500/40 gap-1"
                                                    >🍕 1/2 M</button>
                                                    <button
                                                        onClick={() => startHalfPizza(p, 'G')}
                                                        className="bg-orange-600 text-white h-9 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-md shadow-orange-600/20 active:bg-orange-700 transition-all tracking-wider border border-orange-500/50 gap-1"
                                                    >🍕 1/2 G</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </main>

            {/* BARRA CARRINHO */}
            {cartCount > 0 && !isCartOpen && (
                <div className="fixed bottom-8 left-0 right-0 px-6 z-40">
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="w-full h-16 bg-white text-black rounded-[24px] shadow-[0_20px_50px_rgba(255,255,255,0.1)] flex items-center justify-between px-6 animate-in slide-in-from-bottom-6 group active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg shadow-orange-600/30 group-hover:scale-110 transition-transform">{cartCount}</div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-black/60">Meu Pedido</span>
                        </div>
                        <span className="font-black text-xl tracking-tighter">
                            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </button>
                </div>
            )}

            {/* CARRINHO DRAWER */}
            {isCartOpen && (
                <>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity" onClick={() => setIsCartOpen(false)} />
                    <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-[48px] z-50 max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-full duration-500 shadow-[0_-20px_60px_rgba(0,0,0,0.5)] border-t border-white/5">
                        <div className="p-8 flex items-center justify-between">
                            <h3 className="font-black text-2xl text-white uppercase tracking-tighter">🛒 Meu Pedido</h3>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => {
                                        if(window.confirm("Deseja realmente limpar seu carrinho?")) {
                                            clearCart();
                                            setIsCartOpen(false);
                                        }
                                    }}
                                    className="px-4 py-2 bg-red-500/10 text-red-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-500/20 active:bg-red-500 hover:text-white transition-all"
                                >
                                    Limpar
                                </button>
                                <button onClick={() => setIsCartOpen(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-400 border border-white/5"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-6">
                            {/* INPUT NOME DO CLIENTE NO CARRINHO */}
                            <div className="space-y-4">
                                <div className="bg-white/5 rounded-[24px] p-5 border border-white/5">
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500 mb-3 tracking-[0.2em]">
                                        <User size={12} className="text-orange-500" /> Seu Nome
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Digite seu nome..."
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-orange-500/20 placeholder-gray-600 transition-all select-text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                    />
                                </div>
                                <div className="bg-white/5 rounded-[24px] p-5 border border-white/5">
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500 mb-3 tracking-[0.2em]">
                                        <span className="text-orange-500 text-xs">📍</span> Endereço
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Para onde entregamos?"
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-orange-500/20 placeholder-gray-600 transition-all select-text"
                                        value={customerAddress}
                                        onChange={(e) => setCustomerAddress(e.target.value)}
                                    />
                                </div>
                                <div className="bg-white/5 rounded-[24px] p-5 border border-white/5">
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500 mb-3 tracking-[0.2em]">
                                        <span className="text-orange-500 text-xs">💳</span> Forma de Pagamento
                                    </label>
                                    <select
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-orange-500/20 transition-all appearance-none cursor-pointer"
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                    >
                                        <option value="" className="bg-[#121212] text-gray-400">Como você prefere pagar?</option>
                                        <option value="dinheiro" className="bg-[#121212] text-white font-bold">💵 Dinheiro</option>
                                        <option value="cartao" className="bg-[#121212] text-white font-bold">💳 Cartão na Entrega</option>
                                        <option value="pix" className="bg-[#121212] text-white font-bold">💠 PIX na Entrega</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {cart.map((item) => (
                                    <div key={item.id} className="bg-white/5 rounded-[24px] p-4 border border-white/5">
                                        <div className="flex justify-between items-start mb-4">
                                            <h4 className="font-black text-white text-sm leading-tight max-w-[70%]">{item.name}</h4>
                                            <span className="font-black text-yellow-400 text-sm">{(item.price * item.qty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center bg-black/40 rounded-xl border border-white/5 p-1.5">
                                                <button onClick={() => decrease(item.id)} className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Minus size={14} /></button>
                                                <span className="font-black text-white text-sm px-3">{item.qty}</span>
                                                <button onClick={() => increase(item.id)} className="w-8 h-8 flex items-center justify-center text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"><Plus size={14} /></button>
                                            </div>
                                            <input
                                                placeholder="Obs: Sem picles..."
                                                className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-orange-500/50 transition-all select-text"
                                                value={item.observation || ""}
                                                onChange={(e) => updateObservation(item.id, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="pt-2">
                                <label className="text-[10px] font-black uppercase text-gray-500 mb-3 block tracking-[0.2em] ml-1">Observações Gerais</label>
                                <textarea
                                    rows={2}
                                    className="w-full bg-black/40 border border-white/5 rounded-[24px] p-5 text-sm font-bold text-white outline-none focus:border-orange-500/50 placeholder-gray-700 transition-all resize-none select-text"
                                    placeholder="Algum detalhe extra?"
                                    value={generalObservation}
                                    onChange={(e) => setGeneralObservation(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="p-8 pb-10 bg-black/40 backdrop-blur-3xl border-t border-white/5">
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em]">Total</span>
                                <span className="text-4xl font-black text-white tracking-tighter">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <button
                                onClick={() => {
                                    if (!customerName.trim()) {
                                        alert("Por favor, informe seu nome para o pedido.");
                                        return;
                                    }
                                    if (!customerAddress.trim()) {
                                        alert("Por favor, informe seu endereço para a entrega.");
                                        return;
                                    }
                                    if (!paymentMethod) {
                                        alert("Por favor, selecione a forma de pagamento para finalizarmos.");
                                        return;
                                    }
                                    setShowConfirmModal(true);
                                }}
                                className="w-full h-20 bg-white text-black rounded-[28px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-95 group"
                            >
                                <ShoppingBag size={24} className="group-hover:bounce" /> Finalizar Pedido
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

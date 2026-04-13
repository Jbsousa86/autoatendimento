import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Search, Utensils, Clock, Minus, Plus, X, ShoppingBag } from "lucide-react"
import { categories } from "../data/menu"
import { productService, configService } from "../services/api"
import Logo from "../assets/herosburger.jpg"
import { useCart } from "../context/useCart"

export default function MobileMenu() {
    const { tableId } = useParams()
    const navigate = useNavigate()
    const {
        cart,
        addToCart,
        increase,
        decrease,
        updateObservation,
        getCartTotal,
        finalizeOrder,
        hfPizza,
        hfSize,
        startHalfPizza,
        cancelHalfPizza
    } = useCart()

    const [selectedCategory, setSelectedCategory] = useState("burgers")
    const [isPromoDay, setIsPromoDay] = useState(false)
    const [products, setProducts] = useState([])
    const [settingsHours, setSettingsHours] = useState("18:00 — 00:00")
    const [merchantMessage, setMerchantMessage] = useState("")
    const [tableBanners, setTableBanners] = useState([])
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [generalObservation, setGeneralObservation] = useState("")
    const [customerPhone, setCustomerPhone] = useState("") // Para fidelidade
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [isTableLocked, setIsTableLocked] = useState(false)
    const [fullScreenImage, setFullScreenImage] = useState(null)
    const { clearCart } = useCart()

    // Gera um ID de sessão único para este dispositivo durante esta visita
    const [sid] = useState(() => {
        const saved = sessionStorage.getItem(`table_${tableId}_sid`)
        if (saved) return saved
        const newSid = Math.random().toString(36).substring(7)
        sessionStorage.setItem(`table_${tableId}_sid`, newSid)
        return newSid
    })

    // Lógica de Trava de Mesa (Garantir um por vez)
    useEffect(() => {
        let heartbeatId;

        const checkAndLockTable = async () => {
            try {
                const settings = await configService.getSettings()
                const lockKey = `lock_mesa_${tableId}`
                const lockData = settings.find(s => s.key === lockKey)

                const now = Date.now()

                if (lockData) {
                    try {
                        const { sid: existingSid, ts } = JSON.parse(lockData.value)
                        // Se a trava for de outro ID e for recente (menos de 60s), bloqueia
                        if (existingSid !== sid && (now - ts) < 60000) {
                            setIsTableLocked(true)
                            return
                        }
                    } catch (e) {
                        console.error("Erro ao parsear trava:", e)
                    }
                }

                // Se chegou aqui, a mesa está livre ou é nossa. Reivindica!
                setIsTableLocked(false)
                const newLockValue = JSON.stringify({ sid, ts: now })
                await configService.updateSetting(lockKey, newLockValue)

                // Inicia o heartbeat (atualiza a cada 30s)
                heartbeatId = setInterval(async () => {
                    await configService.updateSetting(lockKey, JSON.stringify({ sid, ts: Date.now() }))
                }, 30000)

            } catch (err) {
                console.error("Erro na trava de mesa:", err)
            }
        }

        checkAndLockTable()

        return () => {
            if (heartbeatId) clearInterval(heartbeatId)
        }
    }, [tableId, sid])

    // Lógica de inatividade: 5 minutos (300.000 ms)
    useEffect(() => {
        let timeoutId;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                // Se ficar inativo por 5 minutos, limpa e volta pro início
                clearCart();
                navigate("/");
            }, 300000); // 5 minutos em milissegundos
        };

        // Eventos que indicam atividade do usuário
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => document.addEventListener(event, resetTimer));

        // Inicia o timer pela primeira vez
        resetTimer();

        // Cleanup: remove os event listeners ao sair da página
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => document.removeEventListener(event, resetTimer));
        };
    }, [navigate, clearCart]);

    useEffect(() => {
        productService.getProducts().then(data => {
            if (data) setProducts(data)
        })
        configService.getSettings().then(data => {
            if (data && Array.isArray(data)) {
                const hoursConfig = data.find(c => c.key === 'hours')
                if (hoursConfig) setSettingsHours(hoursConfig.value)
                const msgConfig = data.find(c => c.key === 'merchant_message')
                if (msgConfig) setMerchantMessage(msgConfig.value)
                const tableBannerConfig = data.find(c => c.key === 'table_banner')
                if (tableBannerConfig) {
                    try {
                        const parsed = JSON.parse(tableBannerConfig.value)
                        setTableBanners(Array.isArray(parsed) ? parsed : (tableBannerConfig.value ? [tableBannerConfig.value] : []))
                    } catch {
                        setTableBanners(tableBannerConfig.value ? [tableBannerConfig.value] : [])
                    }
                }

                const promoDaysConfig = data.find(c => c.key === 'promo_days')
                let promoDays = [1, 2, 3, 4, 5]
                if (promoDaysConfig) {
                    try { promoDays = JSON.parse(promoDaysConfig.value) } catch (e) {}
                }
                const isPromo = promoDays.includes(new Date().getDay())
                setIsPromoDay(isPromo)
                if (isPromo) setSelectedCategory("promocoes")
            }
        })
    }, [])

    useEffect(() => {
        if (tableBanners.length > 1) {
            const timer = setInterval(() => {
                setCurrentBannerIndex((prev) => (prev + 1) % tableBanners.length)
            }, 4000)
            return () => clearInterval(timer)
        }
    }, [tableBanners.length])

    const filteredProducts = (products || []).filter(
        (p) => p.category === selectedCategory
    )

    const handleFinalize = () => {
        setShowConfirmModal(false)
        const customerName = `Mesa ${tableId || "?"}`
        const order = finalizeOrder(customerName, generalObservation, 'mesa', customerPhone)
        order.created_at_client = Date.now()
        navigate(`/mesa/${tableId}/sucesso`, { state: { order }, replace: true })
    }

    const cartCount = (cart || []).reduce((sum, item) => sum + (item.qty || 0), 0)
    const total = typeof getCartTotal === 'function' ? getCartTotal() : 0

    if (isTableLocked) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <Clock size={48} />
                </div>
                <h1 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tighter">Mesa em Uso</h1>
                <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                    Parece que já existe um cliente fazendo um pedido nesta mesa. Por segurança, apenas um dispositivo pode estar logado por vez.
                </p>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-8 w-full">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Dica</p>
                    <p className="text-xs text-gray-600 font-medium italic">Se ninguém estiver usando, aguarde 60 segundos e tente novamente.</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="w-full h-16 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
                >
                    Tentar Novamente
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* MODAL DE IMAGEM EM TELA CHEIA */}
            {fullScreenImage && (
                <div 
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity" 
                    onClick={() => setFullScreenImage(null)}
                >
                    <button className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors z-10">
                        <X size={24} />
                    </button>
                    <img 
                        src={fullScreenImage} 
                        alt="Promoção Ampliada" 
                        className="w-full h-auto max-h-[90vh] object-contain p-4 animate-in zoom-in duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* MODAL DE CONFIRMAÇÃO FINAL */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
                    <div className="bg-white rounded-[32px] w-full max-w-sm p-8 relative z-10 shadow-2xl animate-in zoom-in duration-300">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <ShoppingBag size={40} />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tighter">Confirmar Pedido?</h2>
                            <p className="text-gray-500 font-medium mb-8 leading-tight">
                                Seu pedido de <span className="text-gray-900 font-bold">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> será enviado diretamente para a cozinha.
                            </p>

                            {/* Campo opcional de telefone para fidelidade */}
                            <div className="mb-6">
                                <label className="text-xs font-bold text-gray-600 mb-2 block">📱 Telefone (opcional - para acumular pontos)</label>
                                <input
                                    type="tel"
                                    placeholder="Seu telefone"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none font-bold"
                                />
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={handleFinalize}
                                    className="w-full h-16 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-green-200 active:scale-95 transition-transform"
                                >
                                    SIM, ENVIAR AGORA!
                                </button>
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="w-full h-14 bg-gray-100 text-gray-400 rounded-2xl font-bold uppercase text-xs active:scale-95 transition-transform"
                                >
                                    Ainda não, voltar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* HEADER */}
            <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src={Logo} alt="Logo" className="w-10 h-10 rounded-full border-2 border-orange-500 shadow-sm" />
                    <div>
                        <h1 className="text-sm font-black text-gray-900 leading-none">Hero's Burger</h1>
                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 mt-1 inline-block">
                            Mesa {tableId}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 text-[9px] font-black text-green-600 uppercase">
                        <Clock size={10} />
                        <span>Aberto</span>
                    </div>
                    <span className="text-[8px] text-gray-400 font-bold">{settingsHours}</span>
                </div>
            </header>

            {/* CATEGORIAS */}
            <nav className="fixed top-[60px] left-0 right-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 overflow-x-auto no-scrollbar py-3 px-4 flex gap-2 transition-all duration-300">
                {(categories || []).filter(cat => cat.id !== 'promocoes' || isPromoDay).map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`whitespace-nowrap px-5 py-2 rounded-full text-xs font-black uppercase transition-all ${selectedCategory === cat.id
                            ? "bg-black text-white shadow-lg scale-105"
                            : "bg-gray-100 text-gray-500"
                            }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </nav>

            {/* LISTA DE PRODUTOS */}
            <main className="flex-1 mt-[120px] pb-32 px-4">
                {merchantMessage && (
                    <div className="mb-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 shadow-lg shadow-orange-500/20 relative overflow-hidden border border-orange-400/50 animate-in fade-in zoom-in duration-500">
                        <p className="text-[11px] font-black text-white text-center leading-relaxed uppercase tracking-[0.15em] relative z-10 italic drop-shadow-md">
                            "{merchantMessage}"
                        </p>
                    </div>
                )}

                {tableBanners.length > 0 && (
                    <div className="mb-6 rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-white relative">
                        <div 
                            className="flex transition-transform duration-500 ease-in-out"
                            style={{ transform: `translateX(-${currentBannerIndex * 100}%)` }}
                        >
                            {tableBanners.map((url, idx) => (
                                <div key={idx} className="w-full flex-shrink-0 p-3 bg-white">
                                    <img
                                        src={url}
                                        alt={`Promoção ${idx + 1}`}
                                        className="w-full h-44 object-cover rounded-3xl shadow-md border border-gray-100 cursor-pointer active:scale-95 transition-transform"
                                        onClick={() => setFullScreenImage(url)}
                                    />
                                </div>
                            ))}
                        </div>
                        {tableBanners.length > 1 && (
                            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                                {tableBanners.map((_, idx) => (
                                    <button key={idx} onClick={() => setCurrentBannerIndex(idx)} className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${idx === currentBannerIndex ? 'w-5 bg-orange-500' : 'w-1.5 bg-gray-300 hover:bg-gray-400'}`} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                        {categories.find(c => c.id === selectedCategory)?.name || "Promoções"}
                    </h2>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{filteredProducts.length} Itens</span>
                </div>

                {hfPizza && (
                    <div className="mb-4 bg-orange-500 text-white p-4 rounded-2xl shadow-lg flex justify-between items-center animate-pulse">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🍕</span>
                            <span className="text-xs font-black uppercase tracking-tight">Escolha o 2º Sabor ({hfSize})</span>
                        </div>
                        <button onClick={cancelHalfPizza} className="text-[10px] font-black bg-black/20 px-2 py-1 rounded-lg uppercase">Sair</button>
                    </div>
                )}

                <div className="space-y-3">
                    {filteredProducts.map((p) => (
                        <div key={p.id} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex gap-3 active:scale-[0.98] transition-transform">
                            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-50 border border-gray-50">
                                {p.image ? (
                                    <img src={p.image} className="w-full h-full object-cover" alt={p.name} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-200">
                                        <Utensils size={24} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 flex flex-col justify-between py-0.5">
                                <div>
                                    <h3 className="font-black text-gray-900 text-sm leading-tight mb-1 line-clamp-1">{p.name}</h3>
                                    <p className="text-[10px] text-gray-400 font-medium line-clamp-2 leading-none">
                                        {p.description}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="font-black text-orange-600 text-base">R$ {Number(p.price).toFixed(2)}</span>

                                    {!['pizzas', 'pizza'].includes(p.category.toLowerCase()) ? (
                                        <button
                                            onClick={() => addToCart(p)}
                                            className="bg-black text-white h-8 px-3 rounded-lg flex items-center justify-center gap-1 active:bg-orange-600 transition-colors"
                                        >
                                            <Plus size={14} />
                                            <span className="text-[10px] font-black uppercase">Add</span>
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => addToCart({ ...p, id: `${p.id}-M`, name: `${p.name} (M)`, price: p.price })}
                                                className="bg-gray-100 text-gray-900 h-11 w-11 rounded-xl flex items-center justify-center font-black text-sm border-2 border-gray-200 active:bg-gray-200 transition-colors"
                                            >M</button>
                                            <button
                                                onClick={() => startHalfPizza(p, 'M')}
                                                className="bg-orange-500 text-white h-11 px-4 rounded-xl flex items-center justify-center font-black text-xs uppercase shadow-lg shadow-orange-500/20 active:bg-orange-600 transition-colors"
                                            >1/2</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* BARRA CARRINHO */}
            {cartCount > 0 && !isCartOpen && (
                <div className="fixed bottom-6 left-0 right-0 px-4 z-40">
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="w-full h-14 bg-black text-white rounded-xl shadow-2xl flex items-center justify-between px-5 animate-in slide-in-from-bottom-6"
                    >
                        <div className="flex items-center gap-2">
                            <div className="bg-orange-500 text-white px-2 py-0.5 rounded text-xs font-black">{cartCount}</div>
                            <span className="text-xs font-black uppercase tracking-widest">Ver Pedido</span>
                        </div>
                        <span className="font-black text-lg">
                            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </button>
                </div>
            )}

            {/* CARRINHO DRAWER */}
            {isCartOpen && (
                <>
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsCartOpen(false)} />
                    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-50 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-500 shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
                        <div className="p-4 flex items-center justify-between border-b border-gray-50">
                            <h3 className="font-black text-xl text-gray-900">Meu Pedido</h3>
                            <div className="flex items-center gap-2">
                                {cart.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm("Deseja realmente limpar seu pedido?")) {
                                                clearCart();
                                                setIsCartOpen(false);
                                            }
                                        }}
                                        className="px-4 py-2 bg-red-500/10 text-red-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-500/20 active:bg-red-500 hover:text-white transition-all"
                                    >
                                        Limpar
                                    </button>
                                )}
                                <button onClick={() => setIsCartOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.map((item) => (
                                <div key={item.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-black text-gray-800 text-xs leading-none">{item.name}</h4>
                                        <span className="font-black text-gray-900 text-xs">{(item.price * item.qty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
                                            <button onClick={() => decrease(item.id)} className="p-1 px-2 text-red-500"><Minus size={14} /></button>
                                            <span className="font-black text-gray-900 text-xs px-2">{item.qty}</span>
                                            <button onClick={() => increase(item.id)} className="p-1 px-2 text-green-600"><Plus size={14} /></button>
                                        </div>
                                        <input
                                            placeholder="Obs: Sem cebola..."
                                            className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none select-text"
                                            value={item.observation || ""}
                                            onChange={(e) => updateObservation(item.id, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="mt-4">
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Observação Geral</label>
                                <textarea
                                    rows={2}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none select-text"
                                    placeholder="Ex: Embalar para viagem..."
                                    value={generalObservation}
                                    onChange={(e) => setGeneralObservation(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="p-6 bg-white border-t border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black uppercase text-gray-400">Total</span>
                                <span className="text-3xl font-black text-gray-900 tracking-tighter">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <button
                                onClick={() => setShowConfirmModal(true)}
                                disabled={cart.length === 0}
                                className={`w-full h-16 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-transform active:scale-95 ${
                                    cart.length === 0 
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                                        : 'bg-black text-white hover:bg-gray-900'
                                }`}
                            >
                                <ShoppingBag size={20} /> Finalizar na Mesa
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

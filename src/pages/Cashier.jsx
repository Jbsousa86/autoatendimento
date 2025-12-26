import { useState, useEffect } from "react"
import { productService, orderService, cashierService } from "../services/api"
import { categories } from "../data/menu"

export default function Cashier() {
    // Auth State
    const [user, setUser] = useState(null) // { id, name }
    const [loginUser, setLoginUser] = useState("")
    const [loginPass, setLoginPass] = useState("")

    // App State
    const [activeTab, setActiveTab] = useState('pos') // 'pos' | 'history'
    const [products, setProducts] = useState([])
    const [cart, setCart] = useState([])
    const [dailyOrders, setDailyOrders] = useState([])
    const [selectedCategory, setSelectedCategory] = useState("burgers")
    const [lastFinishedOrder, setLastFinishedOrder] = useState(null)
    const [mobileCartOpen, setMobileCartOpen] = useState(false) // Mobile State

    // Effects
    useEffect(() => {
        if (user) {
            loadProducts()
            loadDailyHistory()
        }
    }, [user])

    const loadProducts = async () => {
        const data = await productService.getProducts()
        setProducts(data)
    }

    const loadDailyHistory = async () => {
        const all = await orderService.getOrders()
        // Filtrar por hoje e por este usuário
        // OBS: Em app real, faria filtro no backend. Aqui simulo no frontend.
        const today = new Date().toLocaleDateString('en-CA')

        const myOrders = all.filter(o => {
            const oDate = new Date(o.created_at).toLocaleDateString('en-CA')
            return o.cashier_name === user.name && oDate === today
        })
        setDailyOrders(myOrders)
    }

    // Handlers
    const handleLogin = async (e) => {
        e.preventDefault()
        try {
            const cashier = await cashierService.login(loginUser, loginPass)
            if (cashier) {
                setUser(cashier)
                setLoginUser("")
                setLoginPass("")
            } else {
                alert("Credenciais inválidas!")
            }
        } catch (error) {
            console.error(error)
            alert("Erro no login.")
        }
    }

    const addToCart = (product) => {
        const newItem = { ...product, tempId: Date.now() }
        setCart([...cart, newItem])
    }

    const removeFromCart = (tempId) => {
        setCart(cart.filter(item => item.tempId !== tempId))
    }

    const handleFinishOrder = async () => {
        if (cart.length === 0) return alert("Carrinho vazio!")

        const total = cart.reduce((acc, item) => acc + (Number(item.price) || 0), 0)

        // Agrupar itens para o formato do banco
        // O formato esperado em 'items' é [{ name, qty, price, observation... }]
        // Vamos simplificar e agrupar por nome
        const itemMap = {}
        cart.forEach(p => {
            if (!itemMap[p.name]) {
                itemMap[p.name] = {
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    qty: 0
                }
            }
            itemMap[p.name].qty += 1
        })
        const finalItems = Object.values(itemMap)

        const orderPayload = {
            orderNumber: Math.floor(1000 + Math.random() * 9000), // Mock number
            customerName: "Balcão",
            total: total,
            items: finalItems,
            cashierName: user.name
        }

        await orderService.createOrder(orderPayload)

        // Reset
        setCart([])
        setLastFinishedOrder(orderPayload)
        loadDailyHistory() // Atualiza relatório
        // alert("✅ Venda Registrada!")
    }

    const calculateTotal = () => cart.reduce((acc, item) => acc + (Number(item.price) || 0), 0)

    // Render Login
    if (!user) {
        return (
            <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4">
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
                    <h1 className="text-2xl font-black text-center mb-6 text-gray-800">🦊 Login do Caixa</h1>

                    <label className="block text-sm font-bold text-gray-600 mb-1">Usuário</label>
                    <input
                        className="w-full border p-3 rounded mb-4"
                        value={loginUser}
                        onChange={e => setLoginUser(e.target.value)}
                        placeholder="Ex: maria"
                        autoFocus
                    />

                    <label className="block text-sm font-bold text-gray-600 mb-1">Senha</label>
                    <input
                        className="w-full border p-3 rounded mb-6"
                        type="password"
                        value={loginPass}
                        onChange={e => setLoginPass(e.target.value)}
                        placeholder="******"
                    />

                    <button className="w-full bg-orange-600 text-white font-bold py-3 rounded hover:bg-orange-700 transition">
                        ENTRAR NO SISTEMA
                    </button>
                    <button type="button" onClick={() => window.location.href = "/"} className="w-full mt-4 text-xs text-center text-gray-400 hover:text-white">
                        (Voltar ao início)
                    </button>
                </form>
            </div>
        )
    }

    // Render Dashboard
    const filteredProducts = products.filter(p => p.category === selectedCategory)

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* HEADER */}
            <header className="bg-gray-900 text-white p-4 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-4">
                    <div className="bg-orange-600 w-10 h-10 rounded-full flex items-center justify-center font-bold">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-none">{user.name}</h1>
                        <p className="text-xs text-gray-400">Operador de Caixa</p>
                    </div>
                </div>

                <div className="flex bg-gray-800 rounded-lg p-1 overflow-x-auto max-w-[200px] md:max-w-none">
                    <button
                        onClick={() => setActiveTab('pos')}
                        className={`px-4 md:px-6 py-2 rounded-md text-xs md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'pos' ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        🛒 VENDA
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 md:px-6 py-2 rounded-md text-xs md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        📋 CAIXA
                    </button>
                </div>

                <button
                    onClick={() => setUser(null)}
                    className="text-red-400 hover:text-red-200 text-sm font-bold"
                >
                    SAIR
                </button>
            </header>

            {/* CONTENT */}
            <main className="flex-1 overflow-hidden relative">
                {/* MODAL DE SUCESSO / IMPRESSÃO */}
                {lastFinishedOrder && (
                    <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                                ✅
                            </div>
                            <h2 className="text-2xl font-black text-gray-800 mb-2">Venda Realizada!</h2>
                            <p className="text-gray-500 mb-8">Pedido <strong>#{lastFinishedOrder.orderNumber}</strong> registrado com sucesso.</p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => window.print()}
                                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                                >
                                    🖨️ IMPRIMIR RECIBO
                                </button>
                                <button
                                    onClick={() => setLastFinishedOrder(null)}
                                    className="w-full bg-gray-200 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-300"
                                >
                                    Nova Venda
                                </button>
                            </div>
                        </div>

                        {/* COMPROVANTE (HIDDEN) COPIADO DO FINISH.JSX */}
                        <div id="receipt" className="hidden">
                            <div className="p-4 max-w-[80mm] mx-auto text-black bg-white font-mono text-xs leading-tight">
                                <div className="text-center mb-4">
                                    <h2 className="text-xl font-black uppercase">Heros Burger</h2>
                                    <p className="text-xs">Rua Antonio moreira, 123</p>
                                    <p className="text-xs">CNPJ: 00.000.000/0001-00</p>
                                </div>
                                <div className="border-b border-black border-dashed my-2"></div>
                                <div className="flex justify-between font-bold text-lg my-2">
                                    <span>PEDIDO:</span>
                                    <span className="text-2xl">{lastFinishedOrder.orderNumber}</span>
                                </div>
                                <div className="text-xs mb-2">
                                    Data: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}
                                </div>
                                <div className="text-xs mb-2 uppercase">
                                    Caixa: {lastFinishedOrder.cashierName}
                                </div>
                                <div className="border-b border-black border-dashed my-2"></div>
                                <table className="w-full text-left mb-4">
                                    <thead>
                                        <tr className="text-xs border-b border-dashed border-black">
                                            <th className="py-1">Qtd</th>
                                            <th className="py-1">Item</th>
                                            <th className="py-1 text-right">Vl.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lastFinishedOrder.items.map((item, i) => (
                                            <tr key={i}>
                                                <td className="py-1 align-top w-6">{item.qty}x</td>
                                                <td className="py-1 align-top">{item.name}</td>
                                                <td className="py-1 align-top text-right">
                                                    {(Number(item.price) * (item.qty || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="border-t border-black border-dashed pt-2 my-2">
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>TOTAL</span>
                                        <span>{Number(lastFinishedOrder.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                </div>
                                <div className="text-center mt-6 text-xs">
                                    <p>Obrigado pela preferência!</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'pos' && (
                    <div className="h-full flex flex-col md:flex-row relative">
                        {/* COLUNA 1: PRODUTOS */}
                        <div className="flex-1 flex flex-col md:border-r border-gray-200 bg-white overflow-hidden">
                            {/* Categorias */}
                            <div className="p-4 flex gap-2 overflow-x-auto border-b border-gray-100 scrollbar-hide">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm flex-shrink-0 ${selectedCategory === cat.id
                                            ? 'bg-orange-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>

                            {/* Grid Produtos */}
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 pb-24 md:pb-4">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                                    {filteredProducts.map(product => (
                                        <div
                                            key={product.id}
                                            onClick={() => addToCart(product)}
                                            className="bg-white p-3 md:p-4 rounded-lg shadow cursor-pointer active:scale-95 transition flex flex-col items-center text-center border border-gray-100"
                                        >
                                            <div className="h-20 md:h-24 w-full bg-gray-100 rounded mb-2 overflow-hidden mb-2">
                                                {product.image ? (
                                                    <img src={product.image} className="w-full h-full object-cover" />
                                                ) : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sem foto</div>}
                                            </div>
                                            <h3 className="font-bold text-xs md:text-sm text-gray-800 leading-tight mb-1 line-clamp-2">{product.name}</h3>
                                            <p className="text-green-600 font-bold text-sm">R$ {parseFloat(product.price).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* COLUNA 2: CARRINHO (RESPONSIVO) */}
                        {/* Mobile Overlay Background */}
                        {mobileCartOpen && (
                            <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setMobileCartOpen(false)} />
                        )}

                        <div className={`
                            fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-30 transform transition-transform duration-300 ease-in-out
                            md:relative md:transform-none md:w-96 md:flex md:flex-col md:shadow-none md:z-auto
                            ${mobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                        `}>
                            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                <div>
                                    <h2 className="font-black text-lg text-gray-700">ORDEM ATUAL</h2>
                                    <p className="text-xs text-gray-400">Cliente Balcão</p>
                                </div>
                                <button
                                    onClick={() => setMobileCartOpen(false)}
                                    className="md:hidden text-gray-400 hover:text-gray-600 p-2"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2 h-[calc(100vh-250px)] md:h-auto">
                                {cart.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                                        Nenhum item selecionado
                                    </div>
                                ) : (
                                    cart.map((item, idx) => (
                                        <div key={item.tempId} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                                            <div>
                                                <p className="font-bold text-sm text-gray-800 line-clamp-1">{item.name}</p>
                                                <p className="text-xs text-gray-500">R$ {parseFloat(item.price).toFixed(2)}</p>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.tempId)}
                                                className="text-red-400 hover:text-red-600 font-bold px-2 py-2"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-6 bg-gray-100 border-t border-gray-200">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-gray-600 font-bold">TOTAL</span>
                                    <span className="text-3xl font-black text-gray-900">R$ {calculateTotal().toFixed(2)}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        handleFinishOrder()
                                        setMobileCartOpen(false)
                                    }}
                                    className="w-full bg-green-600 text-white py-4 rounded-xl font-black text-xl hover:bg-green-700 shadow-lg transition transform active:scale-95"
                                >
                                    CONFIRMAR VENDA
                                </button>
                            </div>
                        </div>

                        {/* MOBILE BOTTOM BAR (TRIGGER) */}
                        {!mobileCartOpen && cart.length > 0 && (
                            <div className="fixed bottom-0 left-0 right-0 bg-gray-900 p-4 md:hidden z-20 flex items-center justify-between shadow-lg cursor-pointer" onClick={() => setMobileCartOpen(true)}>
                                <div className="flex items-center gap-3">
                                    <div className="bg-orange-500 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm">
                                        {cart.length}
                                    </div>
                                    <div className="text-white">
                                        <p className="text-xs text-gray-400 uppercase font-bold">Total</p>
                                        <p className="font-bold text-lg">R$ {calculateTotal().toFixed(2)}</p>
                                    </div>
                                </div>
                                <button className="bg-white text-black px-4 py-2 rounded-lg font-bold text-sm">
                                    VER CARRINHO
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="max-w-4xl mx-auto p-8">
                        <div className="bg-white p-8 rounded-xl shadow-lg">
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">📋 Fluxo do Dia</h2>
                            <p className="text-gray-500 mb-8">Resumo das vendas realizadas por <strong>{user.name}</strong> hoje.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                                    <h3 className="text-blue-600 font-bold text-sm uppercase">Total Vendido</h3>
                                    <p className="text-3xl font-black text-blue-900">
                                        R$ {dailyOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-purple-50 p-6 rounded-lg border border-purple-100">
                                    <h3 className="text-purple-600 font-bold text-sm uppercase">Pedidos Feitos</h3>
                                    <p className="text-3xl font-black text-purple-900">
                                        {dailyOrders.length}
                                    </p>
                                </div>
                            </div>

                            <div className="overflow-hidden border rounded-lg">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="p-3">Hora</th>
                                            <th className="p-3">Itens</th>
                                            <th className="p-3 text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {dailyOrders.map(order => (
                                            <tr key={order.id}>
                                                <td className="p-3 text-gray-500 font-mono text-sm">
                                                    {new Date(order.created_at).toLocaleTimeString().slice(0, 5)}
                                                </td>
                                                <td className="p-3 text-sm text-gray-800">
                                                    {order.items.length} itens <span className="text-gray-400 text-xs">#{order.order_number}</span>
                                                </td>
                                                <td className="p-3 text-right font-bold text-green-600">
                                                    R$ {Number(order.total).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                        {dailyOrders.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="p-6 text-center text-gray-400">Nenhuma venda hoje.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

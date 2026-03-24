import { useState, useEffect } from "react"
import { MapPin, User, Receipt, Clock, Calendar, DollarSign, BarChart3, TrendingUp, Package, Users, Settings, Search, Trash2 } from "lucide-react"
import { productService, orderService, cashierService, configService } from "../services/api"
import { products as defaultProducts } from "../data/menu"

// ==========================================
// 🔒 CONFIGURAÇÃO DE SEGURANÇA
// A senha agora vem do arquivo .env (VITE_ADMIN_PASSWORD)
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD
// ==========================================

export default function Admin() {
    // Estados de Autenticação com persistência simples
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem("admin_auth") === "true"
    })
    const [passwordInput, setPasswordInput] = useState("")

    // Estados Gerais
    const [activeTab, setActiveTab] = useState('products') // 'products' | 'reports'
    const [devMode, setDevMode] = useState(false) // Modo secreto 🕵️
    const [titleClicks, setTitleClicks] = useState(0)

    // Estados do CRUD Produtos
    const [products, setProducts] = useState([])
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState({})

    const [stats, setStats] = useState({
        revenue: 0, count: 0, ticket: 0, topItems: [],
        revenueTotem: 0, countTotem: 0,
        revenueOnline: 0, countOnline: 0,
        revenueCashier: 0, countCashier: 0,
        cashierBreakdown: {},
        paymentBreakdown: { dinheiro: 0, cartao: 0, pix: 0, totem: 0, whatsapp: 0, outro: 0 }
    })
    const [allOrders, setAllOrders] = useState([])

    // Estados dos Caixas
    const [cashiers, setCashiers] = useState([])
    const [newCashierName, setNewCashierName] = useState("")
    const [newCashierPass, setNewCashierPass] = useState("")

    // Configura data inicial para o PRIMEIRO dia do mês atual
    const getFirstDayOfMonth = () => {
        const date = new Date()
        return new Date(date.getFullYear(), date.getMonth(), 1).toLocaleDateString('en-CA')
    }
    const getToday = () => new Date().toLocaleDateString('en-CA')

    const [startDate, setStartDate] = useState(getToday())
    const [endDate, setEndDate] = useState(getToday())
    const [businessHours, setBusinessHours] = useState("18:00 — 00:00")
    const [reportFilter, setReportFilter] = useState('all') // 'all' | 'totem' | 'cashier'
    const [orderSearchQuery, setOrderSearchQuery] = useState("")
    const [whatsappNumber, setWhatsappNumber] = useState("")
    const [merchantMessage, setMerchantMessage] = useState("")
    const [isOnlineMenuOpen, setIsOnlineMenuOpen] = useState(true)

    useEffect(() => {
        if (isAuthenticated) {
            loadData()
            loadSettings()
            if (activeTab === 'users') loadCashiers()
        }
    }, [isAuthenticated, activeTab])

    // Busca relatórios quando a aba é 'reports' ou as datas mudam
    useEffect(() => {
        if (isAuthenticated && activeTab === 'reports') {
            loadReports()
        }
    }, [isAuthenticated, activeTab, startDate, endDate])

    // Recalcula estatísticas quando a data ou a lista de pedidos muda


    const loadSettings = async () => {
        const data = await configService.getSettings()
        const hoursConfig = data.find(c => c.key === 'hours')
        const waConfig = data.find(c => c.key === 'whatsapp')
        const msgConfig = data.find(c => c.key === 'merchant_message')
        const openConfig = data.find(c => c.key === 'is_open')

        if (hoursConfig) setBusinessHours(hoursConfig.value)
        if (waConfig) setWhatsappNumber(waConfig.value)
        if (msgConfig) setMerchantMessage(msgConfig.value)
        if (openConfig) setIsOnlineMenuOpen(openConfig.value === 'true' || openConfig.value === true)
    }

    const handleSaveConfig = async () => {
        try {
            await configService.updateSetting('hours', businessHours)
            await configService.updateSetting('whatsapp', whatsappNumber)
            await configService.updateSetting('merchant_message', merchantMessage)
            await configService.updateSetting('is_open', isOnlineMenuOpen)
            alert("✅ Configurações atualizadas!")
        } catch (error) {
            alert("❌ Erro ao salvar configurações.")
        }
    }

    const loadData = async () => {
        const data = await productService.getProducts()
        setProducts(data)
    }

    const loadReports = async () => {
        // Conversão precisa considerando o fuso horário local
        const startIso = new Date(startDate + 'T00:00:00').toISOString()
        const endIso = new Date(endDate + 'T23:59:59.999').toISOString()

        const orders = await orderService.getOrders(startIso, endIso)
        setAllOrders(orders)
        calculateStats(orders)
    }

    const loadCashiers = async () => {
        const data = await cashierService.getCashiers()
        setCashiers(data)
    }

    const handleAddCashier = async (e) => {
        e.preventDefault()
        if (!newCashierName || !newCashierPass) return alert("Preencha nome e senha!")

        try {
            await cashierService.createCashier(newCashierName, newCashierPass)
            setNewCashierName("")
            setNewCashierPass("")
            loadCashiers()
            alert("Caixa adicionado!")
        } catch (error) {
            alert("Erro ao criar caixa.")
        }
    }

    const handleDeleteCashier = async (id) => {
        if (confirm("Remover este operador?")) {
            await cashierService.deleteCashier(id)
            loadCashiers()
        }
    }

    const handleToggleReportAccess = async (cashier) => {
        try {
            const newValue = !cashier.can_view_reports
            await cashierService.updateCashier(cashier.id, { can_view_reports: newValue })
            loadCashiers()
        } catch (error) {
            alert("Erro ao atualizar permissão. Verifique se a coluna 'can_view_reports' existe no banco.")
        }
    }

    const calculateStats = (orders) => {
        // 1. Faturamento Total (garantindo número)
        const revenue = orders.reduce((acc, order) => acc + (Number(order.total) || 0), 0)

        // 2. Total de Pedidos
        const count = orders.length

        // 3. Ticket Médio
        const ticket = count > 0 ? revenue / count : 0

        // 4. Breakdown Totem vs Online vs Caixa
        let revenueTotem = 0
        let countTotem = 0
        let revenueOnline = 0
        let countOnline = 0
        let revenueCashier = 0
        let countCashier = 0
        const cashierBreakdown = {}
        const paymentBreakdown = { dinheiro: 0, cartao: 0, pix: 0, totem: 0, whatsapp: 0, outro: 0 }

        orders.forEach(order => {
            const val = Number(order.total) || 0

            // Breakdown por Pagamento (tenta snake e camel case)
            const pgtoMethod = (order.payment_method || order.paymentMethod || "").toLowerCase()
            
            // Lógica Robusta de Identificação de Origem
            // 1. Usa o campo pgtoMethod já extraído acima
            
            // 2. Se for 'whatsapp', é ONLINE
            // 3. Se for 'totem', é TOTEM
            // 4. Se não tiver esses campos, usa a lógica de fallback legada
            const isMesa = order.customer_name?.toLowerCase().startsWith('mesa')
            
            let source = 'unknown'
            if (pgtoMethod === 'whatsapp') {
                source = 'online'
            } else if (order.cashier_name && order.cashier_name.trim() !== "") {
                source = 'cashier'
            } else if (isMesa) {
                source = 'mesa'
            } else {
                // Se não é whatsapp, não tem cashier_name, e não é mesa, é totem (ou um método de pagamento do totem)
                source = 'totem'
            }

            const isOnline = source === 'online'
            const isTotem = source === 'totem'
            const isCashier = source === 'cashier'
            
            const pgto = (pgtoMethod || (isCashier ? 'outro' : (isMesa ? 'totem' : 'totem'))).toLowerCase()
            
            if (paymentBreakdown.hasOwnProperty(pgto)) {
                paymentBreakdown[pgto] += val
            } else {
                paymentBreakdown.outro += val
            }

            // Origem: Online, Caixa ou Totem
            if (isTotem) {
                revenueTotem += val
                countTotem++
            } else if (isOnline) {
                revenueOnline += val
                countOnline++
            } else if (isCashier) {
                revenueCashier += val
                countCashier++

                if (!cashierBreakdown[order.cashier_name]) {
                    cashierBreakdown[order.cashier_name] = { revenue: 0, count: 0 }
                }
                cashierBreakdown[order.cashier_name].revenue += val
                cashierBreakdown[order.cashier_name].count++
            }
        })

        // 5. Itens Mais Vendidos
        const itemMap = {}
        orders.forEach(order => {
            if (Array.isArray(order.items)) {
                order.items.forEach(item => {
                    itemMap[item.name] = (itemMap[item.name] || 0) + item.qty
                })
            }
        })

        const topItems = Object.entries(itemMap)
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5) // Top 5

        setStats({
            revenue, count, ticket, topItems,
            revenueTotem, countTotem,
            revenueOnline, countOnline,
            revenueCashier, countCashier,
            cashierBreakdown,
            paymentBreakdown
        })
    }

    const handleLogin = (e) => {
        e.preventDefault()
        if (passwordInput === ADMIN_PASSWORD) {
            setIsAuthenticated(true)
            localStorage.setItem("admin_auth", "true")
        } else {
            alert("Senha incorreta!")
            setPasswordInput("")
        }
    }

    const handleLogout = () => {
        setIsAuthenticated(false)
        localStorage.removeItem("admin_auth")
    }

    const handleEdit = (product) => {
        setEditingId(product.id)
        setForm(product)
    }

    const handleSave = async () => {
        await productService.saveProduct(form)
        setEditingId(null)
        loadData()
        alert("Produto salvo com sucesso!")
    }

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const handleAddNew = () => {
        const tempId = Date.now()
        const newProduct = { id: tempId, name: "", price: "", description: "", image: "", category: "burgers" }
        setProducts([newProduct, ...products])
        setEditingId(tempId)
        setForm(newProduct) // Start editing immediately
    }

    const handleDelete = async (id) => {
        if (confirm("Tem certeza que deseja excluir este produto?")) {
            await productService.deleteProduct(id)
            loadData()
        }
    }

    const handleRestoreDefaults = async () => {
        if (confirm("⚠️ PERIGO: Isso vai apagar/duplicar dados. Tem certeza?")) {
            alert("Iniciando restauração... aguarde.")
            for (const p of defaultProducts) {
                // Remove o ID para o Supabase criar um novo automático
                const { id, ...prodWithoutId } = p
                await productService.saveProduct({ ...prodWithoutId, image: "" })
            }
            loadData()
            alert("Produtos padrão restaurados com sucesso!")
        }
    }

    const handleArchiveOrders = async () => {
        if (confirm("⚠️ ISSO LIMPARÁ A TELA DA COZINHA.\n\nOs pedidos abertos serão marcados como finalizados, mas continuarão aparecendo nos relatórios.\n\nDeseja continuar?")) {
            await orderService.archiveAllOrders()
            alert("✅ Tela da cozinha limpa com sucesso!")
            loadReports() // Recarrega para refletir status (se necessário)
        }
    }

    const handleDeleteOrder = async (order) => {
        const confirmMsg = `⚠️ EXCLUIR PERMANENTEMENTE?\n\nPedido: #${order.order_number}\nCliente: ${order.customer_name}\nTotal: R$ ${Number(order.total).toFixed(2)}\n\nEsta ação não pode ser desfeita.`
        if (confirm(confirmMsg)) {
            try {
                await orderService.deleteOrder(order.id)
                loadReports()
                alert("✅ Pedido excluído com sucesso!")
            } catch (error) {
                alert("❌ Erro ao excluir pedido.")
            }
        }
    }

    const handleSecretClick = () => {
        const newCount = titleClicks + 1
        setTitleClicks(newCount)
        if (newCount === 5) {
            setDevMode(true)
            alert("🕵️ Modo Avançado Ativado!")
        }
    }

    // TELA DE LOGIN
    if (!isAuthenticated) {
        return (
            <div style={{
                minHeight: '100vh',
                backgroundColor: '#111827',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 9999
            }}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    width: '100%',
                    maxWidth: '400px',
                    borderTop: '8px solid #1f2937'
                }}>
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <span style={{ fontSize: '40px' }}>🔒</span>
                        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111827', marginTop: '10px', textTransform: 'uppercase' }}>Acesso Restrito</h1>
                        <p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 'bold' }}>PAINEL ADMIN</p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', marginBottom: '8px' }}>
                                Digite a Senha Mestra
                            </label>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="Sua senha aqui..."
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    border: '3px solid #6b7280',
                                    fontSize: '20px',
                                    color: 'black',
                                    backgroundColor: 'white',
                                    display: 'block',
                                    boxSizing: 'border-box'
                                }}
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: '12px',
                                backgroundColor: '#111827',
                                color: 'white',
                                fontWeight: '900',
                                fontSize: '18px',
                                cursor: 'pointer',
                                border: 'none'
                            }}
                        >
                            LIBERAR ACESSO
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    // PAINEL ADMIN (RESTURADO PARA TABELA - DESKTOP FIRST)
    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="w-full md:w-auto">
                    <div className="flex items-center gap-4 mb-4">
                        <h1
                            className="text-2xl md:text-3xl font-bold text-gray-800 cursor-pointer select-none"
                            onClick={handleSecretClick}
                            title="Dica: Clique 5 vezes aqui para opções avançadas"
                        >
                            ⚙️ Admin {devMode && <span className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">DEV</span>}
                        </h1>
                        <button
                            onClick={handleLogout}
                            className="bg-gray-200 hover:bg-red-100 hover:text-red-600 text-gray-500 px-3 py-1 rounded-lg text-xs font-black transition-colors"
                        >
                            SAIR
                        </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:grid md:grid-cols-4 md:w-auto md:gap-4 scrollbar-hide">
                        <button
                            onClick={() => setActiveTab('products')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === 'products' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                            📦 PRODUTOS
                        </button>
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === 'reports' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                            📈 RELATÓRIOS
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === 'users' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                            👥 EQUIPE
                        </button>
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === 'config' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                            ⚙️ CONFIG
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 md:gap-4 mt-4 md:mt-0">
                    {activeTab === 'products' && (
                        <>
                            {devMode && (
                                <button
                                    onClick={handleRestoreDefaults}
                                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 font-bold animate-pulse text-xs md:text-sm"
                                >
                                    ⚠️ RESETAR
                                </button>
                            )}
                            <button
                                onClick={handleAddNew}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold text-xs md:text-sm whitespace-nowrap"
                            >
                                + NOVO
                            </button>
                        </>
                    )}


                </div>
            </header>

            {/* TAB PRODUTOS */}
            {activeTab === 'products' && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden overflow-x-auto">
                    <div className="min-w-[800px]"> {/* Force min width for table */}
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-200 text-gray-600 uppercase text-sm font-bold">
                                <tr>
                                    <th className="p-4">ID</th>
                                    <th className="p-4">Nome</th>
                                    <th className="p-4">Preço (R$)</th>
                                    <th className="p-4">Categoria</th>
                                    <th className="p-4">Descrição</th>
                                    <th className="p-4">Imagem (URL)</th>
                                    <th className="p-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {products.map(product => (
                                    <tr key={product.id} className="hover:bg-gray-50">
                                        {editingId === product.id ? (
                                            // MODO EDIÇÃO
                                            <>
                                                <td className="p-4 text-gray-400 text-xs">auto</td>
                                                <td className="p-4">
                                                    <input
                                                        className="border p-2 rounded w-full"
                                                        placeholder="Nome do produto"
                                                        value={form.name}
                                                        onChange={e => handleChange('name', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    {/* SE FOR PIZZA, MOSTRA 3 CAMPOS */}
                                                    {(form.category === 'pizzas' || form.category === 'pizza') ? (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs font-bold text-red-500 w-4">P:</span>
                                                                <input
                                                                    className="border p-1 rounded w-20 text-sm"
                                                                    type="number"
                                                                    placeholder="Auto"
                                                                    value={form.price_p || ''}
                                                                    onChange={e => handleChange('price_p', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs font-bold text-gray-700 w-4">M:</span>
                                                                <input
                                                                    className="border p-1 rounded w-20 text-sm font-bold"
                                                                    type="number"
                                                                    placeholder="0.00"
                                                                    value={form.price}
                                                                    onChange={e => handleChange('price', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs font-bold text-green-600 w-4">G:</span>
                                                                <input
                                                                    className="border p-1 rounded w-20 text-sm"
                                                                    type="number"
                                                                    placeholder="Auto"
                                                                    value={form.price_g || ''}
                                                                    onChange={e => handleChange('price_g', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* OUTROS PRODUTOS (APENAS 1 PREÇO) */
                                                        <input
                                                            className="border p-2 rounded w-20"
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={form.price}
                                                            onChange={e => handleChange('price', e.target.value)}
                                                        />
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <select
                                                        className="border p-2 rounded w-full"
                                                        value={form.category}
                                                        onChange={e => handleChange('category', e.target.value)}
                                                    >
                                                        <option value="burgers">Hambúrgueres</option>
                                                        <option value="pizzas">Pizzas</option>
                                                        <option value="drinks">Sucos</option>
                                                        <option value="sodas">Refrigerantes</option>
                                                    </select>
                                                </td>
                                                <td className="p-4">
                                                    <textarea
                                                        className="border p-2 rounded w-full text-sm"
                                                        rows={2}
                                                        placeholder="Descrição curta"
                                                        value={form.description || ''}
                                                        onChange={e => handleChange('description', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <input
                                                        className="border p-2 rounded w-full text-xs"
                                                        placeholder="https://..."
                                                        value={form.image || ''}
                                                        onChange={e => handleChange('image', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-4 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={handleSave}
                                                        className="bg-blue-600 text-white px-3 py-1 rounded font-bold text-sm shadow hover:bg-blue-500 mr-2"
                                                    >
                                                        SALVAR
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(null)
                                                            loadData()
                                                        }}
                                                        className="text-gray-400 hover:text-red-500 text-sm"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </td>
                                            </>
                                        ) : (
                                            // MODO VISUALIZAÇÃO
                                            <>
                                                <td className="p-4 font-mono text-xs text-gray-400">#{product.id}</td>
                                                <td className="p-4 font-bold text-gray-800">{product.name}</td>
                                                <td className="p-4 text-green-600 font-bold">R$ {parseFloat(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                <td className="p-4 text-gray-500 text-xs uppercase">{product.category}</td>
                                                <td className="p-4 text-gray-500 text-sm max-w-xs truncate" title={product.description}>
                                                    {product.description || '-'}
                                                </td>
                                                <td className="p-4 text-blue-500 text-xs truncate max-w-[150px]">
                                                    {product.image ? (
                                                        <a href={product.image} target="_blank" className="hover:underline">VER IMAGEM</a>
                                                    ) : (
                                                        <span className="text-gray-300">Sem imagem</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={() => handleEdit(product)}
                                                        className="text-blue-600 font-bold hover:underline mr-4 text-sm"
                                                    >
                                                        EDITAR
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="text-red-500 font-bold hover:underline text-sm"
                                                    >
                                                        EXCLUIR
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-8 text-center text-gray-400 text-sm p-4">
                            <p>💡 Edite os produtos aqui. As alterações aparecerão imediatamente no menu do Totem.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB RELATÓRIOS */}
            {activeTab === 'reports' && (
                <div className="max-w-6xl mx-auto">
                    {/* SELETOR DE DATA */}
                    <div className="bg-white p-6 rounded-xl shadow-lg mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">📅 Fluxo de Caixa</h2>
                            <p className="text-gray-500 text-sm">Selecione o período para análise.</p>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                            <button
                                onClick={handleArchiveOrders}
                                className="w-full md:w-auto bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-red-200 border border-red-200 transition-colors whitespace-nowrap"
                                title="Limpa a tela da cozinha movendo pedidos para finalizados"
                            >
                                🧹 Limpar Cozinha
                            </button>
                            <div className="flex flex-row gap-2 w-full md:w-auto">
                                <div className="flex flex-col w-full md:w-auto">
                                    <label className="font-bold text-gray-700 text-xs text-left mb-1">De:</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="border-2 border-gray-300 rounded-lg p-2 text-sm md:text-lg font-mono focus:border-black focus:outline-none w-full"
                                    />
                                </div>
                                <div className="flex flex-col w-full md:w-auto">
                                    <label className="font-bold text-gray-700 text-xs text-left mb-1">Até:</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="border-2 border-gray-300 rounded-lg p-2 text-sm md:text-lg font-mono focus:border-black focus:outline-none w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CARTÕES DE KPI - RESUMO GERAL */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div
                            onClick={() => setReportFilter('all')}
                            className={`p-4 rounded-xl shadow-lg border-l-4 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${reportFilter === 'all' ? 'bg-green-50 border-green-600 scale-[1.02]' : 'bg-white border-green-500'}`}
                        >
                            <h3 className="text-gray-500 font-bold text-[10px] uppercase mb-1">Faturamento Total</h3>
                            <p className="text-2xl font-black text-gray-800">
                                {stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">{stats.count} pedidos</p>
                        </div>

                        <div className="p-4 rounded-xl shadow-lg border-l-4 bg-white border-green-600">
                            <h3 className="text-green-600 font-bold text-[10px] uppercase mb-1">💵 Dinheiro</h3>
                            <p className="text-xl font-black text-gray-800">{stats.paymentBreakdown.dinheiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Total em espécie</p>
                        </div>

                        <div className="p-4 rounded-xl shadow-lg border-l-4 bg-white border-blue-600">
                            <h3 className="text-blue-600 font-bold text-[10px] uppercase mb-1">💳 Cartão</h3>
                            <p className="text-xl font-black text-gray-800">{stats.paymentBreakdown.cartao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Débito/Crédito</p>
                        </div>

                        <div className="p-4 rounded-xl shadow-lg border-l-4 bg-white border-purple-600">
                            <h3 className="text-purple-600 font-bold text-[10px] uppercase mb-1">💎 PIX</h3>
                            <p className="text-xl font-black text-gray-800">{stats.paymentBreakdown.pix.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Transferências</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* DETALHE CARDÁPIO ONLINE */}
                        <div
                            onClick={() => setReportFilter('online')}
                            className={`p-6 rounded-xl shadow-lg border-l-4 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${reportFilter === 'online' ? 'bg-green-50 border-green-600 scale-[1.02]' : 'bg-white border-green-500'}`}
                        >
                            <h3 className="text-green-600 font-bold text-xs uppercase mb-2">📱 Cardápio Online</h3>
                            <p className="text-3xl font-black text-gray-800">
                                {stats.revenueOnline.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                                {stats.countOnline} pedidos (CLIQUE PARA FILTRAR)
                            </p>
                        </div>

                        {/* DETALHE TOTEM */}
                        <div
                            onClick={() => setReportFilter('totem')}
                            className={`p-6 rounded-xl shadow-lg border-l-4 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${reportFilter === 'totem' ? 'bg-blue-50 border-blue-600 scale-[1.02]' : 'bg-white border-blue-500'}`}
                        >
                            <h3 className="text-blue-500 font-bold text-xs uppercase mb-2">🤖 Vendas no Totem</h3>
                            <p className="text-3xl font-black text-gray-800">
                                {stats.revenueTotem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                                {stats.countTotem} pedidos (CLIQUE PARA FILTRAR)
                            </p>
                        </div>

                        {/* DETALHE CAIXA */}
                        <div
                            onClick={() => setReportFilter('cashier')}
                            className={`p-6 rounded-xl shadow-lg border-l-4 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${reportFilter.includes('cashier') ? 'bg-orange-50 border-orange-600 scale-[1.02]' : 'bg-white border-orange-500'}`}
                        >
                            <h3 className="text-orange-500 font-bold text-xs uppercase mb-2">👤 Vendas no Caixa</h3>
                            <p className="text-3xl font-black text-gray-800">
                                {stats.revenueCashier.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                                {stats.countCashier} pedidos {reportFilter.startsWith('cashier:') ? `(Filtrado: ${reportFilter.split(':')[1]})` : '(CLIQUE PARA FILTRAR)'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* VENDAS POR PRODUTO */}
                        <div className="bg-white p-8 rounded-xl shadow-lg">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">🏆 Ranking de Produtos</h2>
                            {stats.topItems.length === 0 ? (
                                <p className="text-gray-400 italic">Nenhum dado de venda ainda...</p>
                            ) : (
                                <div className="space-y-4 mb-8">
                                    {stats.topItems.slice(0, 10).map((item, idx) => (
                                        <div key={idx} className="flex items-center">
                                            <div className="w-8 font-bold text-gray-400 text-xl">#{idx + 1}</div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="font-bold text-lg">{item.name}</span>
                                                    <span className="font-mono bg-gray-100 px-2 rounded text-gray-600 text-sm">{item.qty} un</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2.5">
                                                    <div
                                                        className="bg-blue-600 h-2.5 rounded-full"
                                                        style={{ width: `${(item.qty / stats.topItems[0].qty) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-t pt-8">👤 Vendas por Operador</h2>
                            {Object.keys(stats.cashierBreakdown).length === 0 ? (
                                <p className="text-gray-400 italic">Nenhuma venda em caixa no período.</p>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(stats.cashierBreakdown)
                                        .sort((a, b) => b[1].revenue - a[1].revenue)
                                        .map(([name, data], idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setReportFilter(`cashier:${name}`)}
                                                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all hover:bg-orange-50 ${reportFilter === `cashier:${name}` ? 'bg-orange-100 ring-2 ring-orange-500 shadow-md' : 'bg-gray-50'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold">
                                                        {name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-800">{name}</div>
                                                        <div className="text-xs text-gray-400">{data.count} pedidos realizados</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-black text-orange-600">
                                                        {data.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase">Total Líquido</div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* LISTA DETALHADA DE VENDAS */}
                        <div className="bg-white p-8 rounded-xl shadow-lg overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">📋 Detalhamento</h2>
                                <span className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest ${reportFilter === 'totem' ? 'bg-blue-100 text-blue-700' :
                                    reportFilter.includes('cashier') ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                    {reportFilter === 'totem' ? 'Vendas no Totem' : 
                                     reportFilter === 'online' ? 'Cardápio Online' :
                                     reportFilter.startsWith('cashier:') ? `Caixa: ${reportFilter.split(':')[1]}` : 
                                     reportFilter === 'cashier' ? 'Todos os Caixas' : 'Relatório Geral'}
                                </span>
                            </div>

                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="🔍 Buscar por Nº do Pedido ou Nome..."
                                    className="w-full border-2 border-gray-100 p-3 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                                    value={orderSearchQuery}
                                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="overflow-y-auto max-h-[500px] border rounded-lg">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-black sticky top-0">
                                        <tr>
                                            <th className="p-3">#</th>
                                            <th className="p-3">Horário</th>
                                            <th className="p-3">Cliente</th>
                                            <th className="p-3">Pgto</th>
                                            <th className="p-3 text-right">Valor</th>
                                            {devMode && <th className="p-3 text-center">Ação</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {allOrders
                                            .filter(o => {
                                                // Filtro de Categoria/Operador
                                                const pgtoMethod = (o.payment_method || o.paymentMethod || "").toLowerCase();
                                                const isMesa = o.customer_name?.toLowerCase().startsWith('mesa');
                                                const isOnline = pgtoMethod === 'whatsapp';
                                                const isCashier = o.cashier_name && o.cashier_name.trim() !== "";
                                                const isTotem = !isCashier && !isOnline && !isMesa;

                                                const matchFilter = (reportFilter === 'all') ||
                                                    (reportFilter === 'online' && isOnline) ||
                                                    (reportFilter === 'totem' && isTotem) ||
                                                    (reportFilter.startsWith('cashier:') && o.cashier_name === reportFilter.split(':')[1]) ||
                                                    (reportFilter === 'cashier' && isCashier);

                                                // Filtro de Busca (Número ou Nome)
                                                const search = orderSearchQuery.toLowerCase();
                                                const orderNumStr = String(o.order_number || "");
                                                const matchSearch = !orderSearchQuery ||
                                                    orderNumStr.includes(search) ||
                                                    (o.customer_name && o.customer_name.toLowerCase().includes(search));

                                                return matchFilter && matchSearch;
                                            })
                                            .map((order, idx) => (
                                                <tr key={order.id} className="hover:bg-gray-50 transition-colors text-sm">
                                                    <td className="p-3 font-mono text-gray-400 text-xs">#{order.order_number}</td>
                                                    <td className="p-3 text-gray-500 font-mono">
                                                        {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="p-3 font-bold">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <User size={14} className="text-gray-400" />
                                                                <span className="text-gray-900 text-base">{order.customer_name || "Cliente"}</span>
                                                            </div>
                                                            
                                                            {order.cashier_name && order.cashier_name.trim() !== "" ? (
                                                                <div className="flex items-center gap-1.5 bg-orange-50 px-2 py-0.5 rounded-full w-fit border border-orange-100">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.5)]"></span>
                                                                    <span className="text-[9px] font-black uppercase text-orange-900 tracking-tighter">Operador: {order.cashier_name}</span>
                                                                </div>
                                                            ) : (
                                                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full w-fit border ${ (() => {
                                                                    const pgtoMethod = (order.payment_method || order.paymentMethod || "").toLowerCase();
                                                                    const isOnline = pgtoMethod === 'whatsapp';
                                                                    return isOnline ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200';
                                                                })() }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${ (() => {
                                                                        const pgtoMethod = (order.payment_method || order.paymentMethod || "").toLowerCase();
                                                                        const isMesa = order.customer_name?.toLowerCase().startsWith('mesa');
                                                                        const isOnline = pgtoMethod === 'whatsapp';
                                                                        return isOnline ? 'bg-green-500' : 'bg-blue-500';
                                                                    })() }`}></span>
                                                                    <span className={`text-[9px] font-black uppercase tracking-tighter ${ (() => {
                                                                        const pgtoMethod = (order.payment_method || order.paymentMethod || "").toLowerCase();
                                                                        const isMesa = order.customer_name?.toLowerCase().startsWith('mesa');
                                                                        const isOnline = pgtoMethod === 'whatsapp';
                                                                        return isOnline ? 'text-green-900' : 'text-blue-900';
                                                                    })() }`}>
                                                                        {(() => {
                                                                            const pgtoMethod = (order.payment_method || order.paymentMethod || "").toLowerCase();
                                                                            const isMesa = order.customer_name?.toLowerCase().startsWith('mesa');
                                                                            const isOnline = pgtoMethod === 'whatsapp';
                                                                            
                                                                            if (isMesa) return 'MESA (QR CODE)';
                                                                            return isOnline ? 'CARDÁPIO ONLINE (WA)' : 'TOTEM AUTOATENDIMENTO';
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {order.customer_address && (
                                                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-100 w-fit">
                                                                    <MapPin size={10} className="text-red-400" />
                                                                    <span className="truncate max-w-[200px]">{order.customer_address}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${(order.payment_method === 'dinheiro' || order.paymentMethod === 'dinheiro') ? 'bg-green-100 text-green-700' :
                                                            (order.payment_method === 'cartao' || order.paymentMethod === 'cartao') ? 'bg-blue-100 text-blue-700' :
                                                                (order.payment_method === 'pix' || order.paymentMethod === 'pix') ? 'bg-purple-100 text-purple-700' : 
                                                                    (order.payment_method === 'whatsapp' || order.paymentMethod === 'whatsapp') ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                                                            }`}>
                                                            {order.payment_method === 'whatsapp' || order.paymentMethod === 'whatsapp' ? 'WhatsApp' : 
                                                             (order.payment_method || order.paymentMethod || (order.cashier_name ? 'N/A' : 'Totem'))}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right font-black text-gray-900">
                                                        {Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                    {devMode && (
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => handleDeleteOrder(order)}
                                                                className="text-red-500 hover:text-red-700 p-1"
                                                                title="Excluir Pedido"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        {allOrders.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-gray-400 italic">Sem registros no período.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase text-center">
                                Use os botões coloridos no topo para filtrar a lista
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB USUÁRIOS (CAIXAS) */}
            {
                activeTab === 'users' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white p-8 rounded-xl shadow-lg mb-8">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">➕ Adicionar Operador de Caixa</h2>
                            <form onSubmit={handleAddCashier} className="flex flex-col md:flex-row gap-4 md:items-end">
                                <div className="flex-1 w-full">
                                    <label className="block text-gray-600 text-sm font-bold mb-2">Nome do Usuário</label>
                                    <input
                                        className="w-full border p-3 rounded-lg"
                                        placeholder="Ex: joao.silva"
                                        value={newCashierName}
                                        onChange={e => setNewCashierName(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 w-full">
                                    <label className="block text-gray-600 text-sm font-bold mb-2">Senha de Acesso</label>
                                    <input
                                        className="w-full border p-3 rounded-lg"
                                        type="password"
                                        placeholder="******"
                                        value={newCashierPass}
                                        onChange={e => setNewCashierPass(e.target.value)}
                                    />
                                </div>
                                <button className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 h-[50px] w-full md:w-auto">
                                    ADICIONAR
                                </button>
                            </form>
                        </div>

                        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-200 text-gray-600 uppercase text-sm font-bold">
                                    <tr>
                                        <th className="p-4">ID</th>
                                        <th className="p-4">Nome</th>
                                        <th className="p-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {cashiers.map(cashier => (
                                        <tr key={cashier.id} className="hover:bg-gray-50">
                                            <td className="p-4 text-gray-400 font-mono text-xs max-w-[50px] truncate">{cashier.id}</td>
                                            <td className="p-4 font-bold">{cashier.name}</td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-4">
                                                    <button
                                                        onClick={() => handleToggleReportAccess(cashier)}
                                                        className={`text-[10px] font-black px-3 py-1.5 rounded-full border transition-all ${cashier.can_view_reports
                                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                            : 'bg-gray-100 border-gray-200 text-gray-400 hover:border-gray-300'
                                                            }`}
                                                    >
                                                        {cashier.can_view_reports ? '📊 RELATÓRIOS: ON' : '📊 RELATÓRIOS: OFF'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCashier(cashier.id)}
                                                        className="text-red-500 font-bold hover:bg-red-50 px-3 py-1 rounded text-sm whitespace-nowrap"
                                                    >
                                                        REMOVER
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {cashiers.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-gray-400">
                                                Nenhum operador cadastrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            {/* TAB CONFIGURAÇÕES */}
            {activeTab === 'config' && (
                <div className="max-w-xl mx-auto">
                    <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-yellow-400">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            ⚙️ Configurações do Sistema
                        </h2>

                        <div className="space-y-6">
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 flex items-start gap-3">
                                <span className="text-xl">ℹ️</span>
                                <p className="text-sm text-yellow-800 font-medium">
                                    As alterações feitas aqui serão refletidas instantaneamente na tela principal do Totem (Menu).
                                </p>
                            </div>

                            <div className="w-full bg-white p-6 rounded-2xl border-2 border-gray-100 flex items-center justify-between shadow-sm mb-4">
                                <div>
                                    <label className="block text-gray-900 text-lg font-black uppercase leading-tight">
                                        Cardápio Online Ativo
                                    </label>
                                    <p className="text-sm text-gray-500 font-medium">
                                        Se desativado, os clientes não poderão fazer pedidos.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsOnlineMenuOpen(!isOnlineMenuOpen)}
                                    className={`w-16 h-8 rounded-full transition-all relative ${isOnlineMenuOpen ? 'bg-green-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${isOnlineMenuOpen ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>

                            <div className="w-full">
                                <label className="block text-green-600 text-sm font-black uppercase mb-2 ml-1">
                                    Horário de Funcionamento
                                </label>
                                <input
                                    type="text"
                                    className="w-full border-2 border-gray-200 p-4 rounded-xl text-xl font-bold text-green-600 focus:border-green-400 focus:outline-none transition-all shadow-inner"
                                    placeholder="Ex: 18:00 — 00:00"
                                    value={businessHours}
                                    onChange={(e) => setBusinessHours(e.target.value)}
                                />
                                <p className="mt-2 text-xs text-gray-400 font-medium ml-1">
                                    Dica: Use o formato "Abriremos às 18h" ou "18:00 às 00:00"
                                </p>
                            </div>

                            <div className="w-full">
                                <label className="block text-green-600 text-sm font-black uppercase mb-2 ml-1">
                                    WhatsApp para Pedidos Online
                                </label>
                                <input
                                    type="text"
                                    className="w-full border-2 border-gray-200 p-4 rounded-xl text-xl font-bold text-green-600 focus:border-green-400 focus:outline-none transition-all shadow-inner"
                                    placeholder="Ex: 5563991038781"
                                    value={whatsappNumber}
                                    onChange={(e) => setWhatsappNumber(e.target.value)}
                                />
                                <p className="mt-2 text-xs text-gray-400 font-medium ml-1">
                                    Importante: Use apenas números, com código do país (Brasil é 55) e DDD.
                                </p>
                            </div>

                            <div className="w-full">
                                <label className="block text-green-600 text-sm font-black uppercase mb-2 ml-1">
                                    Mensagem de Boas-vindas (Cardápio Online)
                                </label>
                                <textarea
                                    className="w-full border-2 border-gray-200 p-4 rounded-xl text-lg font-bold text-green-600 focus:border-green-400 focus:outline-none transition-all shadow-inner resize-none"
                                    placeholder="Ex: Sejam bem-vindos ao Hero's Burger!"
                                    rows={3}
                                    value={merchantMessage}
                                    onChange={(e) => setMerchantMessage(e.target.value)}
                                />
                                <p className="mt-2 text-xs text-gray-400 font-medium ml-1">
                                    Esta mensagem aparecerá no topo do cardápio online.
                                </p>
                            </div>

                            <button
                                onClick={handleSaveConfig}
                                className="w-full bg-black text-white font-black py-5 rounded-2xl hover:bg-gray-800 active:scale-95 transition-all text-xl shadow-xl flex items-center justify-center gap-2"
                            >
                                💾 SALVAR ALTERAÇÕES
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

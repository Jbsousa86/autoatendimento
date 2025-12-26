import { useState, useEffect } from "react"
import { productService, orderService, cashierService } from "../services/api"
import { products as defaultProducts } from "../data/menu"

// ==========================================
// 🔒 CONFIGURAÇÃO DE SEGURANÇA
// A senha agora vem do arquivo .env (VITE_ADMIN_PASSWORD)
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD
// ==========================================

export default function Admin() {
    // Estados de Autenticação
    const [isAuthenticated, setIsAuthenticated] = useState(false)
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
        revenueCashier: 0, countCashier: 0
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

    const [startDate, setStartDate] = useState(getFirstDayOfMonth())
    const [endDate, setEndDate] = useState(getToday())

    useEffect(() => {
        if (isAuthenticated) {
            loadData()
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

    const calculateStats = (orders) => {
        // 1. Faturamento Total (garantindo número)
        const revenue = orders.reduce((acc, order) => acc + (Number(order.total) || 0), 0)

        // 2. Total de Pedidos
        const count = orders.length

        // 3. Ticket Médio
        const ticket = count > 0 ? revenue / count : 0

        // 4. Breakdown Totem vs Caixa
        let revenueTotem = 0
        let countTotem = 0
        let revenueCashier = 0
        let countCashier = 0

        orders.forEach(order => {
            const val = Number(order.total) || 0
            // Se tiver cashier_name, é Caixa. Senão, é Totem (cliente final direto)
            if (order.cashier_name) {
                revenueCashier += val
                countCashier++
            } else {
                revenueTotem += val
                countTotem++
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
            revenueCashier, countCashier
        })
    }

    const handleLogin = (e) => {
        e.preventDefault()
        if (passwordInput === ADMIN_PASSWORD) {
            setIsAuthenticated(true)
        } else {
            alert("Senha incorreta!")
            setPasswordInput("")
        }
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
            <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
                <form onSubmit={handleLogin} className="bg-white p-10 rounded-xl shadow-2xl w-full max-w-md">
                    <h1 className="text-3xl font-black text-gray-800 mb-6 text-center">🔒 Acesso Restrito</h1>
                    <div className="mb-6">
                        <label className="block text-gray-600 text-sm font-bold mb-2">Senha do Administrador</label>
                        <input
                            type="password"
                            className="w-full border-2 border-gray-300 p-4 rounded-lg text-xl"
                            autoFocus
                            placeholder="Digite a senha..."
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                        />
                    </div>
                    <button className="w-full bg-black text-white py-4 rounded-lg font-bold text-xl hover:bg-gray-800 transition-colors">
                        ENTRAR
                    </button>

                </form>
            </div>
        )
    }

    // PAINEL ADMIN (RESTURADO PARA TABELA - DESKTOP FIRST)
    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1
                        className="text-3xl font-bold text-gray-800 mb-2 cursor-pointer select-none"
                        onClick={handleSecretClick}
                        title="Dica: Clique 5 vezes aqui para opções avançadas"
                    >
                        ⚙️ Administração {devMode && <span className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">MODO AVANÇADO</span>}
                    </h1>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('products')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'products' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                            📦 PRODUTOS
                        </button>
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'reports' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                            📈 RELATÓRIOS
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'users' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                            👥 EQUIPE
                        </button>
                    </div>
                </div>

                <div className="flex gap-4">
                    {activeTab === 'products' && (
                        <>
                            {devMode && (
                                <button
                                    onClick={handleRestoreDefaults}
                                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 font-bold animate-pulse"
                                >
                                    ⚠️ RESETAR PADRÕES
                                </button>
                            )}
                            <button
                                onClick={handleAddNew}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold"
                            >
                                + NOVO PRODUTO
                            </button>
                        </>
                    )}


                </div>
            </header>

            {/* TAB PRODUTOS */}
            {activeTab === 'products' && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
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
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <button
                                onClick={handleArchiveOrders}
                                className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-red-200 border border-red-200 transition-colors"
                                title="Limpa a tela da cozinha movendo pedidos para finalizados"
                            >
                                🧹 Limpar Cozinha
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                    <label className="font-bold text-gray-700 text-xs text-left mb-1">De:</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="border-2 border-gray-300 rounded-lg p-2 text-lg font-mono focus:border-black focus:outline-none"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label className="font-bold text-gray-700 text-xs text-left mb-1">Até:</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="border-2 border-gray-300 rounded-lg p-2 text-lg font-mono focus:border-black focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CARTÕES DE KPI - RESUMO GERAL */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
                            <h3 className="text-gray-500 font-bold text-xs uppercase mb-2">Faturamento Total</h3>
                            <p className="text-4xl font-black text-gray-800">
                                {stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                                {stats.count} pedidos no total
                            </p>
                        </div>

                        {/* DETALHE TOTEM */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
                            <h3 className="text-blue-500 font-bold text-xs uppercase mb-2">🤖 Vendas no Totem</h3>
                            <p className="text-3xl font-black text-gray-800">
                                {stats.revenueTotem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                                {stats.countTotem} pedidos
                            </p>
                        </div>

                        {/* DETALHE CAIXA */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-orange-500">
                            <h3 className="text-orange-500 font-bold text-xs uppercase mb-2">👤 Vendas no Caixa</h3>
                            <p className="text-3xl font-black text-gray-800">
                                {stats.revenueCashier.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                                {stats.countCashier} pedidos
                            </p>
                        </div>
                    </div>

                    {/* VENDAS POR PRODUTO */}
                    <div className="bg-white p-8 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">🏆 Produtos Mais Vendidos</h2>
                        {stats.topItems.length === 0 ? (
                            <p className="text-gray-400 italic">Nenhum dado de venda ainda...</p>
                        ) : (
                            <div className="space-y-4">
                                {stats.topItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center">
                                        <div className="w-8 font-bold text-gray-400 text-xl">#{idx + 1}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-bold text-lg">{item.name}</span>
                                                <span className="font-mono bg-gray-100 px-2 rounded text-gray-600">{item.qty} un</span>
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
                    </div>
                </div>
            )}

            {/* TAB USUÁRIOS (CAIXAS) */}
            {activeTab === 'users' && (
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white p-8 rounded-xl shadow-lg mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">➕ Adicionar Operador de Caixa</h2>
                        <form onSubmit={handleAddCashier} className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-gray-600 text-sm font-bold mb-2">Nome do Usuário</label>
                                <input
                                    className="w-full border p-3 rounded-lg"
                                    placeholder="Ex: joao.silva"
                                    value={newCashierName}
                                    onChange={e => setNewCashierName(e.target.value)}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-gray-600 text-sm font-bold mb-2">Senha de Acesso</label>
                                <input
                                    className="w-full border p-3 rounded-lg"
                                    type="password"
                                    placeholder="******"
                                    value={newCashierPass}
                                    onChange={e => setNewCashierPass(e.target.value)}
                                />
                            </div>
                            <button className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 h-[50px]">
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
                                            <button
                                                onClick={() => handleDeleteCashier(cashier.id)}
                                                className="text-red-500 font-bold hover:bg-red-50 px-3 py-1 rounded"
                                            >
                                                REMOVER
                                            </button>
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
        </div>
    )
}

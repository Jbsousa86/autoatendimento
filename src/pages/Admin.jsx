import { useState, useEffect } from "react"
import { productService, orderService } from "../services/api"
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

    const [stats, setStats] = useState({ revenue: 0, count: 0, ticket: 0, topItems: [] })
    const [allOrders, setAllOrders] = useState([])

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
            if (activeTab === 'reports') loadReports()
        }
    }, [isAuthenticated, activeTab])

    // Recalcula estatísticas quando a data ou a lista de pedidos muda
    useEffect(() => {
        if (activeTab === 'reports' && allOrders.length > 0) {
            const filtered = allOrders.filter(order => {
                if (!order.created_at) return false
                // Normaliza a data do pedido para YYYY-MM-DD (Local Time)
                // O uso de 'en-CA' garante o formato YYYY-MM-DD
                const orderDate = new Date(order.created_at).toLocaleDateString('en-CA')
                return orderDate >= startDate && orderDate <= endDate
            })
            calculateStats(filtered)
        }
    }, [startDate, endDate, allOrders, activeTab])

    const loadData = async () => {
        const data = await productService.getProducts()
        setProducts(data)
    }

    const loadReports = async () => {
        const orders = await orderService.getOrders()
        setAllOrders(orders)
        // O useEffect vai cuidar de calcular com base na data selecionada
    }

    const calculateStats = (orders) => {
        // 1. Faturamento Total (garantindo número)
        const revenue = orders.reduce((acc, order) => acc + (Number(order.total) || 0), 0)

        // 2. Total de Pedidos
        const count = orders.length

        // 3. Ticket Médio
        const ticket = count > 0 ? revenue / count : 0

        // 4. Itens Mais Vendidos
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

        setStats({ revenue, count, ticket, topItems })
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
                    <button
                        type="button"
                        onClick={() => window.location.href = "/"}
                        className="w-full mt-6 text-gray-500 hover:text-black underline"
                    >
                        Voltar ao Totem
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

                    <button
                        onClick={() => window.location.href = "/"}
                        className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700"
                    >
                        Voltar ao Totem
                    </button>
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

                    {/* CARTÕES DE KPI */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
                            <h3 className="text-gray-500 font-bold text-sm uppercase mb-2">Faturamento Total</h3>
                            <p className="text-4xl font-black text-gray-800">
                                {stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
                            <h3 className="text-gray-500 font-bold text-sm uppercase mb-2">Total de Pedidos</h3>
                            <p className="text-4xl font-black text-gray-800">
                                {stats.count}
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
                            <h3 className="text-gray-500 font-bold text-sm uppercase mb-2">Ticket Médio</h3>
                            <p className="text-4xl font-black text-gray-800">
                                {stats.ticket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
        </div>
    )
}

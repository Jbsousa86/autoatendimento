import { useState, useEffect } from "react"
import { productService, orderService, cashierService } from "../services/api"
import { categories } from "../data/menu"
import logo from "../assets/herosburger.jpg"

export default function Cashier() {
    const [user, setUser] = useState(null)
    const [loginUser, setLoginUser] = useState("")
    const [loginPass, setLoginPass] = useState("")
    const [activeTab, setActiveTab] = useState('pos')
    const [products, setProducts] = useState([])
    const [cart, setCart] = useState([])
    const [customerName, setCustomerName] = useState("")
    const [dailyOrders, setDailyOrders] = useState([])
    const [selectedCategory, setSelectedCategory] = useState("burgers")
    const [lastFinishedOrder, setLastFinishedOrder] = useState(null)
    const [mobileCartOpen, setMobileCartOpen] = useState(false)
    const [printerDevice, setPrinterDevice] = useState(null)
    const [printerStatus, setPrinterStatus] = useState("disconnected")
    const [selectedPizza, setSelectedPizza] = useState(null)
    const [selectingHalf, setSelectingHalf] = useState(null)
    const [firstFlavor, setFirstFlavor] = useState(null)
    const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-CA'))
    const [orderObservation, setOrderObservation] = useState("")
    const [isPrinting, setIsPrinting] = useState(false)

    useEffect(() => {
        if (user) {
            loadProducts()
            loadDailyHistory()
            const subscription = orderService.subscribeToOrders(() => loadDailyHistory())
            const handleAfterPrint = () => setLastFinishedOrder(null)
            window.addEventListener('afterprint', handleAfterPrint)

            // Auto-reconnect: tenta silenciosamente sempre que autenticado
            // Aumentamos a frequência e verificamos se realmente está desconectado
            const reconnectTimer = setInterval(() => {
                if (user && printerStatus === 'disconnected') {
                    console.log("Tentativa de reconexão automática...");
                    connectPrinter(true)
                }
            }, 10000);

            return () => {
                if (subscription) subscription.unsubscribe()
                window.removeEventListener('afterprint', handleAfterPrint)
                clearInterval(reconnectTimer)
            }
        }
    }, [user, activeTab, printerStatus]) // Adicionado printerStatus para reagir a quedas

    const loadProducts = async () => {
        const data = await productService.getProducts()
        setProducts(data)
    }

    const loadDailyHistory = async () => {
        const all = await orderService.getOrders()
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0)
        const recentOrders = all.filter(o => new Date(o.created_at) >= sevenDaysAgo)
        recentOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        setDailyOrders(recentOrders)
    }

    // Handlers
    const connectPrinter = async (isAuto = false) => {
        const auto = isAuto === true;

        if (!navigator.bluetooth) {
            if (!auto) alert("❌ Bluetooth não suportado neste navegador.");
            return null;
        }

        try {
            setPrinterStatus("connecting");
            const commonServices = [
                '000018f0-0000-1000-8000-00805f9b34fb',
                '00004953-0000-1000-8000-00805f9b34fb',
                '0000e7e1-0000-1000-8000-00805f9b34fb',
                '0000ff00-0000-1000-8000-00805f9b34fb', // Adicionado
                '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                '0000ae30-0000-1000-8000-00805f9b34fb'  // Adicionado
            ];

            let device;

            if (navigator.bluetooth.getDevices) {
                const availableDevices = await navigator.bluetooth.getDevices();
                if (availableDevices.length > 0) {
                    device = availableDevices.find(d =>
                        ['POS', 'MP', 'MTP', 'Inner', 'Goojprt', 'BT', 'PRINTER', 'MINI'].some(p => d.name?.toUpperCase().includes(p))
                    ) || availableDevices[0];
                }
            }

            if (!device && !auto) {
                device = await navigator.bluetooth.requestDevice({
                    filters: [
                        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
                        { namePrefix: 'Inner' },
                        { namePrefix: 'POS' },
                        { namePrefix: 'mini' },
                        { namePrefix: 'MP' },
                        { namePrefix: 'MTP' },
                        { namePrefix: 'Goojprt' },
                        { namePrefix: 'BT' },
                        { namePrefix: 'PRINTER' }
                    ],
                    optionalServices: commonServices
                });
            }

            if (!device) {
                setPrinterStatus("disconnected");
                return null;
            }

            // Se já estiver conectado, não reconecta desnecessariamente
            if (device.gatt.connected && printerDevice) {
                setPrinterStatus("connected");
                return printerDevice;
            }

            const server = await device.gatt.connect();
            let service;

            // Tenta encontrar o serviço correto entre os comuns
            for (const uuid of commonServices) {
                try {
                    service = await server.getPrimaryService(uuid);
                    if (service) break;
                } catch (e) { continue; }
            }

            if (!service) {
                // Tenta pegar qualquer serviço se os comuns falharem
                const services = await server.getPrimaryServices();
                if (services.length > 0) service = services[0];
            }

            if (!service) throw new Error("Serviço de impressão não encontrado.");

            const characteristics = await service.getCharacteristics();
            const characteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);

            if (!characteristic) throw new Error("Canal de escrita não encontrado.");

            setPrinterDevice(characteristic);
            setPrinterStatus("connected");

            device.addEventListener('gattserverdisconnected', () => {
                setPrinterStatus("disconnected");
                setPrinterDevice(null);
                setTimeout(() => connectPrinter(true), 5000);
            });

            return characteristic;
        } catch (error) {
            console.error("Bluetooth Error:", error);
            setPrinterStatus("disconnected");
            if (error.name !== 'AbortError' && !auto) {
                alert(`❌ Erro: ${error.message || "Não foi possível conectar."}`);
            }
            return null;
        }
    };

    // Auto-reconnect on mount if browser allows
    useEffect(() => {
        if (user && printerStatus === 'disconnected') {
            connectPrinter(true);
        }
    }, [user]);

    const printBluetooth = async (isManual = false) => {
        let activeDevice = printerDevice;

        // Se manual e não tiver dispositivo, abre o seletor nativo
        if (!activeDevice) {
            activeDevice = await connectPrinter(!isManual);
        }

        if (!activeDevice || !lastFinishedOrder) return false;

        try {
            const encoder = new TextEncoder();

            // Função para limpar acentos (muitas impressoras térmicas não suportam UTF-8/acentos nativamente)
            const cleanText = (str) => {
                return str.normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^\x00-\x7F]/g, ""); // Remove qualquer caractere não-ASCII restante
            };

            const txt = (str) => encoder.encode(cleanText(str) + '\n');

            const INIT = new Uint8Array([0x1B, 0x40]);
            const CENTER = new Uint8Array([0x1B, 0x61, 0x01]);
            const LEFT = new Uint8Array([0x1B, 0x61, 0x00]);
            const BOLD_ON = new Uint8Array([0x1B, 0x45, 0x01]);
            const BOLD_OFF = new Uint8Array([0x1B, 0x45, 0x00]);
            const DOUBLE_ON = new Uint8Array([0x1B, 0x21, 0x30]);
            const DOUBLE_OFF = new Uint8Array([0x1B, 0x21, 0x01]);
            const FEED = new Uint8Array([0x1D, 0x56, 0x41, 0x03]);

            let data = new Uint8Array([
                ...INIT, ...CENTER, ...BOLD_ON, ...DOUBLE_ON, ...txt("HERO'S BURGER"), ...DOUBLE_OFF,
                ...txt("CNPJ: 48.507.205/0001-94"),
                ...txt("Tel: (63) 99103-8781"),
                ...txt("Comprovante de Venda"), ...BOLD_OFF,
                ...txt("--------------------------------"),
                ...BOLD_ON, ...txt(`PEDIDO: ${lastFinishedOrder.orderNumber}`), ...BOLD_OFF,
                ...LEFT, ...txt(`Data: ${new Date().toLocaleString('pt-BR')}`),
                ...txt(`Caixa: ${user?.name || 'Sistema'}`),
                ...txt(`Cliente: ${lastFinishedOrder.customerName || 'Nao informado'}`),
                ...txt("--------------------------------"),
            ]);

            lastFinishedOrder.items.forEach(item => {
                // Nome completo do item
                data = new Uint8Array([...data, ...txt(`${item.qty}x ${item.name}`)]);

                // Preço alinhado à direita na linha seguinte para garantir que o nome nunca seja cortado
                const itemTotal = (Number(item.price) * item.qty).toFixed(2);
                const priceLine = `R$ ${itemTotal}`.padStart(32);
                data = new Uint8Array([...data, ...txt(priceLine)]);

                if (item.observation) data = new Uint8Array([...data, ...txt(`  > ${item.observation}`)]);
            });

            if (lastFinishedOrder.observation) {
                data = new Uint8Array([...data, ...txt(`OBS: ${lastFinishedOrder.observation}`)]);
            }

            data = new Uint8Array([
                ...data,
                ...txt("--------------------------------"),
                ...BOLD_ON, ...txt(`TOTAL: R$ ${Number(lastFinishedOrder.total).toFixed(2)}`), ...BOLD_OFF,
                ...CENTER, ...txt("\nObrigado pela preferencia!"), ...FEED
            ]);

            // Determina o método de escrita mais compatível
            const writeMethod = activeDevice.writeValueWithoutResponse ? 'writeValueWithoutResponse' :
                activeDevice.writeValueWithResponse ? 'writeValueWithResponse' :
                    'writeValue';

            const chunkSize = 20;

            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                try {
                    await activeDevice[writeMethod](chunk);
                } catch (writeErr) {
                    console.error("Write error, trying fallback:", writeErr);
                    // Fallback para o método básico se o detectado falhar
                    await (activeDevice.writeValue ? activeDevice.writeValue(chunk) : Promise.reject("Sem metodo de escrita"));
                }
                // Pequeno delay para não sobrecarregar o buffer da impressora
                await new Promise(r => setTimeout(r, 20));
            }
            return true;
        } catch (error) {
            console.error("Print Error:", error);
            // Se falhou por desconexão, limpa o estado
            setPrinterStatus("disconnected");
            setPrinterDevice(null);
            return false;
        }
    }

    const handleReprint = async (order) => {
        const reprintData = {
            orderNumber: order.order_number,
            items: order.items,
            total: order.total,
            cashierName: order.cashier_name || "Totem",
            customerName: order.customer_name || ""
        }
        setLastFinishedOrder(reprintData)
        // No reprint manual, não disparamos nada automático para não confundir
    }

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
        // PRIORIDADE: Se estiver escolhendo a segunda metade, adiciona direto!
        if (selectingHalf) {
            const p1 = firstFlavor
            const p2 = product
            const size = selectingHalf

            const price1 = size === 'M' ? Number(p1.price) : Number(p1.price_g || p1.price * 1.2)
            const price2 = size === 'M' ? Number(p2.price) : Number(p2.price_g || p2.price * 1.2)
            const finalPrice = Math.max(price1, price2)

            const combo = {
                ...product, // Pega a base do produto para manter IDs etc se necessário
                name: `1/2 ${p1.name} / 1/2 ${p2.name} (${size})`,
                price: finalPrice,
                qty: 1,
                category: 'pizzas',
                tempId: Date.now(),
                observation: ""
            }

            setCart([...cart, combo])
            setSelectingHalf(null)
            setFirstFlavor(null)
            return
        }

        // Se for pizza e não estiver no modo meio-a-meio, abre modal (para escolher Inteira ou Iniciar Meio-a-Meio)
        if (product.category === 'pizzas' || product.category === 'pizza') {
            setSelectedPizza(product)
            return
        }

        // Produto normal
        const newItem = { ...product, tempId: Date.now(), observation: "", qty: 1 }
        setCart([...cart, newItem])
    }

    const handlePizzaSelection = (size, price, isHalf = false) => {
        if (!selectedPizza) return

        if (isHalf) {
            setSelectingHalf(size)
            setFirstFlavor(selectedPizza)
            setSelectedPizza(null)
            return
        }

        const newItem = {
            ...selectedPizza,
            name: `${selectedPizza.name} (${size})`,
            price: price, // Usa o preço do tamanho selecionado
            tempId: Date.now(),
            observation: "",
            qty: 1
        }
        setCart([...cart, newItem])
        setSelectedPizza(null)
    }

    const updateItemObservation = (tempId, obs) => {
        setCart(cart.map(item => item.tempId === tempId ? { ...item, observation: obs } : item))
    }

    const increaseQty = (tempId) => {
        setCart(cart.map(item => item.tempId === tempId ? { ...item, qty: (item.qty || 1) + 1 } : item))
    }

    const decreaseQty = (tempId) => {
        setCart(cart.map(item =>
            item.tempId === tempId ? { ...item, qty: Math.max(1, (item.qty || 1) - 1) } : item
        ))
    }

    const removeFromCart = (tempId) => {
        setCart(cart.filter(item => item.tempId !== tempId))
    }

    const handleFinishOrder = async () => {
        if (cart.length === 0) return alert("Carrinho vazio!")

        const itemMap = {}
        cart.forEach(p => {
            const key = `${p.name}-${p.observation || ''}`
            if (!itemMap[key]) itemMap[key] = { id: p.id, name: p.name, price: p.price, qty: 0, observation: p.observation || "" }
            itemMap[key].qty += (p.qty || 1)
        })

        const orderPayload = {
            orderNumber: Math.floor(1000 + Math.random() * 9000),
            customerName: customerName || "Balcão",
            total: calculateTotal(),
            items: Object.values(itemMap),
            cashierName: user.name,
            observation: orderObservation
        }

        await orderService.createOrder(orderPayload)

        // Atualiza estado e limpa carrinho
        setLastFinishedOrder(orderPayload)
        setCart([])
        setCustomerName("")
        setOrderObservation("")
        loadDailyHistory()

        // AUTO-PRINT: Só tenta se estiver conectado, para não abrir diálogos chatos
        if (printerStatus === 'connected') {
            setTimeout(() => printBluetooth(), 500)
        }
    }

    const calculateTotal = () => cart.reduce((acc, item) => acc + (Number(item.price) * (item.qty || 1)), 0)

    // Render Login
    if (!user) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
                {/* Efeitos de fundo para dar identidade */}
                <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-orange-600/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-yellow-600/10 rounded-full blur-3xl"></div>

                <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm relative z-10 border-t-8 border-orange-600">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-2xl mb-4 transform rotate-6 shadow-xl overflow-hidden border-4 border-orange-50">
                            <img src={logo} alt="Heros Burger Logo" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter leading-none">
                            Heros <span className="text-orange-600 italic">Burger</span>
                        </h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mt-2">Sistema de Gestão</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Identificação</label>
                            <input
                                className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-gray-800 font-bold focus:border-orange-500 focus:bg-white focus:outline-none transition-all"
                                value={loginUser}
                                onChange={e => setLoginUser(e.target.value)}
                                placeholder="Seu nome de usuário"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Senha de Acesso</label>
                            <input
                                className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-gray-800 font-bold focus:border-orange-500 focus:bg-white focus:outline-none transition-all"
                                type="password"
                                value={loginPass}
                                onChange={e => setLoginPass(e.target.value)}
                                placeholder="••••••"
                            />
                        </div>
                    </div>

                    <button className="w-full bg-orange-600 text-white font-black py-5 rounded-2xl hover:bg-orange-700 hover:shadow-lg hover:-translate-y-1 active:translate-y-0 transition-all text-lg mt-8 shadow-xl flex items-center justify-center gap-2">
                        <span>⚡</span> ENTRAR NO SERVIÇO
                    </button>

                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-gray-300 font-medium">© 2025 HEROS BURGER • QUALIDADE HEROICA</p>
                    </div>
                </form>
            </div>
        )
    }

    // Render Dashboard
    const filteredProducts = products.filter(p => p.category === selectedCategory)

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* HEADER */}
            <header className="bg-gray-900 text-white p-4 flex justify-between items-center shadow-md screen-only">
                <div className="flex items-center gap-4">
                    <div className="bg-orange-600 w-10 h-10 rounded-full flex items-center justify-center font-bold">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden xs:block">
                        <h1 className="font-bold text-sm md:text-lg leading-none">{user.name}</h1>
                        <p className="text-[10px] text-gray-400">Operador</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    {/* INDICADOR DE IMPRESSORA */}
                    <button
                        onClick={connectPrinter}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${printerStatus === 'connected'
                            ? 'bg-green-600/10 border-green-500 text-green-400'
                            : printerStatus === 'connecting'
                                ? 'bg-yellow-600/10 border-yellow-500 text-yellow-400 animate-pulse'
                                : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500'
                            }`}
                        title={printerStatus === 'connected' ? 'Impressora Conectada' : 'Clique para conectar Impressora Bluetooth'}
                    >
                        <span className="text-sm">🖨️</span>
                        <span className="text-[10px] font-black uppercase hidden md:inline">
                            {printerStatus === 'connected' ? 'ONLINE' : printerStatus === 'connecting' ? 'BUSCANDO...' : 'IMPRESSORA OFF'}
                        </span>
                        {printerStatus === 'connected' && <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>}
                    </button>

                    <div className="flex bg-gray-800 rounded-lg p-1 overflow-x-auto max-w-[200px] sm:max-w-[250px] md:max-w-none">
                        <button
                            onClick={() => setActiveTab('pos')}
                            className={`px-3 md:px-6 py-2 rounded-md text-xs md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'pos' ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            🛒 VENDA
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-3 md:px-6 py-2 rounded-md text-xs md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            📋 CAIXA
                        </button>
                        <button
                            onClick={() => window.open("/kitchen", "_blank")}
                            className="px-3 md:px-6 py-2 rounded-md text-xs md:text-sm font-bold transition whitespace-nowrap text-gray-400 hover:text-orange-400"
                        >
                            🧑‍🍳 COZINHA
                        </button>
                    </div>

                    <button
                        onClick={() => setUser(null)}
                        className="text-red-400 hover:text-red-200 text-sm font-bold bg-red-400/10 p-2 rounded-lg"
                    >
                        SAIR
                    </button>
                </div>
            </header>

            {/* CONTENT */}
            <main className="flex-1 overflow-hidden relative">
                {/* MODAL DE SUCESSO / IMPRESSÃO */}
                {lastFinishedOrder && (
                    <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:bg-white print:p-0">
                        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center screen-only">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                                ✅
                            </div>
                            <h2 className="text-2xl font-black text-gray-800 mb-2">Venda Realizada!</h2>
                            <p className="text-gray-500 mb-8">Pedido <strong>#{lastFinishedOrder.orderNumber}</strong> registrado com sucesso.</p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={async () => {
                                        if (isPrinting) return
                                        setIsPrinting(true)
                                        const success = await printBluetooth(true)
                                        setIsPrinting(false)
                                        if (success) setLastFinishedOrder(null)
                                        else alert("⚠️ Falha ao imprimir no Bluetooth. Verifique a conexão.")
                                    }}
                                    disabled={isPrinting}
                                    className={`w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all ${isPrinting ? 'opacity-50 cursor-wait' : 'hover:bg-blue-700 active:scale-95'}`}
                                >
                                    {isPrinting ? '⏳ IMPRIMINDO...' : '🖨️ IMPRIMIR BLUETOOTH'}
                                </button>

                                <button
                                    onClick={() => window.print()}
                                    className="text-gray-400 text-xs font-bold uppercase hover:text-gray-600 py-2"
                                >
                                    Usar Impressora Wi-Fi/Sistema
                                </button>

                                <div className="h-[2px] bg-gray-100 my-6"></div>

                                <button
                                    onClick={() => setLastFinishedOrder(null)}
                                    className="w-full bg-gray-200 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-300"
                                >
                                    Nova Venda
                                </button>
                            </div>
                        </div>

                        {/* COMPROVANTE (HIDDEN) COPIADO DO FINISH.JSX */}
                        <div id="receipt" className="hidden print:block">
                            <div className="text-black bg-white font-mono text-xs leading-tight">
                                <div className="text-center mb-4">
                                    <h2 className="text-xl font-black uppercase">Hero's Burger</h2>
                                    <p className="text-xs">Rua Antonio moreira, 123</p>
                                    <p className="text-xs">CNPJ: 48.507.205/0001-94</p>
                                    <p className="text-xs">TEL: (63) 99103-8781</p>
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
                                <div className="text-xs mb-2 uppercase font-bold">
                                    Cliente: {lastFinishedOrder.customerName || "Não informado"}
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
                                            <tr key={i} className="border-b border-black border-dashed last:border-0 font-bold">
                                                <td className="py-1.5 align-top w-6">{item.qty}x</td>
                                                <td className="py-1.5 align-top">
                                                    <div className="leading-tight break-words">{item.name}</div>
                                                    {item.observation && <div className="text-[10px] italic mt-0.5 font-normal">➔ {item.observation}</div>}
                                                </td>
                                                <td className="py-1.5 align-top text-right whitespace-nowrap pl-2">
                                                    {(Number(item.price) * (item.qty || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {lastFinishedOrder.observation && (
                                    <div className="border border-black p-1 text-[10px] mb-2 mt-2">
                                        <span className="font-bold">OBS: </span> {lastFinishedOrder.observation}
                                    </div>
                                )}
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

                {/* AVISO SELEÇÃO SEGUNDO SABOR */}
                {
                    selectingHalf && (
                        <div className="absolute top-0 left-0 right-0 bg-red-600 text-white p-3 z-[60] flex justify-between items-center animate-pulse">
                            <span className="font-bold">🍕 SELECIONANDO 2º SABOR PARA PIZZA {selectingHalf} (1º Sabor: {firstFlavor?.name})</span>
                            <button
                                onClick={() => { setSelectingHalf(null); setFirstFlavor(null); }}
                                className="bg-white text-red-600 px-3 py-1 rounded text-xs font-black"
                            >
                                CANCELAR
                            </button>
                        </div>
                    )
                }

                {/* MODAL SELEÇÃO DE TAMANHO (PIZZA) */}
                {
                    selectedPizza && (
                        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
                                <h2 className="text-2xl font-black text-gray-800 mb-2">🍕 Escolha o Tamanho</h2>
                                <p className="text-gray-500 mb-6">Selecione o tamanho para <strong>{selectedPizza.name}</strong></p>

                                <div className="flex flex-col gap-4">
                                    {/* PEQUENA */}
                                    <button
                                        onClick={() => handlePizzaSelection('P', selectedPizza.price_p)}
                                        disabled={!selectedPizza.price_p}
                                        className={`w-full py-4 rounded-xl font-bold flex justify-between px-6 border-2 transition ${!selectedPizza.price_p ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400' : 'border-red-500 text-red-600 hover:bg-red-50'}`}
                                    >
                                        <span>PEQUENA (P)</span>
                                        <span>{selectedPizza.price_p ? `R$ ${parseFloat(selectedPizza.price_p).toFixed(2)}` : '--'}</span>
                                    </button>

                                    {/* MÉDIA */}
                                    <div className="border-2 border-gray-800 rounded-xl overflow-hidden">
                                        <div className="bg-gray-800 text-white text-xs font-bold py-1 uppercase tracking-tighter">Média (M) • R$ {parseFloat(selectedPizza.price).toFixed(2)}</div>
                                        <div className="flex">
                                            <button
                                                onClick={() => handlePizzaSelection('M', selectedPizza.price)}
                                                className="flex-1 py-3 font-bold hover:bg-gray-100 border-r border-gray-200"
                                            >
                                                INTEIRA
                                            </button>
                                            <button
                                                onClick={() => handlePizzaSelection('M', selectedPizza.price, true)}
                                                className="flex-1 py-3 font-bold text-orange-600 hover:bg-orange-50"
                                            >
                                                1/2 A 1/2
                                            </button>
                                        </div>
                                    </div>

                                    {/* GRANDE */}
                                    <div className={`border-2 rounded-xl overflow-hidden ${!selectedPizza.price_g ? 'opacity-50 grayscale pointer-events-none' : 'border-green-600'}`}>
                                        <div className="bg-green-600 text-white text-xs font-bold py-1 uppercase tracking-tighter">Grande (G) • {selectedPizza.price_g ? `R$ ${parseFloat(selectedPizza.price_g).toFixed(2)}` : '--'}</div>
                                        <div className="flex">
                                            <button
                                                onClick={() => handlePizzaSelection('G', selectedPizza.price_g)}
                                                className="flex-1 py-3 font-bold hover:bg-gray-100 border-r border-gray-200"
                                            >
                                                INTEIRA
                                            </button>
                                            <button
                                                onClick={() => handlePizzaSelection('G', selectedPizza.price_g, true)}
                                                className="flex-1 py-3 font-bold text-orange-600 hover:bg-orange-50"
                                            >
                                                1/2 A 1/2
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setSelectedPizza(null)}
                                        className="w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-300 mt-4"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'pos' && (
                        <div className="h-full flex flex-col md:flex-row relative">
                            {/* COLUNA 1: PRODUTOS */}
                            <div className="flex-1 flex flex-col md:border-r border-gray-200 bg-white overflow-hidden screen-only">
                                {/* MONITOR DE AUTOATENDIMENTO (TOTEM) */}
                                <div className="bg-orange-50 p-2 border-b border-orange-100 flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
                                    <div className="bg-orange-600 text-white text-[8px] md:text-[9px] font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded shadow-sm flex items-center gap-1 shrink-0">
                                        <span className="animate-ping">●</span> <span className="hidden xs:inline">TOTEM AO VIVO</span><span className="xs:hidden">TOTEM</span>
                                    </div>
                                    {dailyOrders.filter(o => !o.cashier_name && o.status === 'pending').slice(0, 5).map(o => (
                                        <div key={o.id} className="text-[11px] font-bold text-orange-900 bg-white px-3 py-1 rounded-full border border-orange-200 shadow-sm transition-all hover:scale-105">
                                            #{o.order_number} - {o.customer_name}
                                        </div>
                                    ))}
                                    {dailyOrders.filter(o => !o.cashier_name && o.status === 'pending').length === 0 && (
                                        <span className="text-[10px] text-gray-400 font-bold uppercase italic ml-2">Nenhum pedido novo no autoatendimento</span>
                                    )}
                                </div>

                                {/* Categorias */}
                                <div className="p-4 flex gap-2 overflow-x-auto border-b border-gray-100 scrollbar-hide">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategory(cat.id)}
                                            className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm flex-shrink-0 ${selectedCategory === cat.id
                                                ? 'bg-orange-600 text-white shadow-lg shadow-orange-200'
                                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
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
                                                <h3 className="font-bold text-[11px] md:text-sm text-gray-800 leading-tight mb-1 line-clamp-2">{product.name}</h3>
                                                <p className="text-green-600 font-black text-xs md:text-sm">R$ {parseFloat(product.price).toFixed(2)}</p>
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
                            fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-30 transform transition-transform duration-300 ease-in-out flex flex-col
                            md:relative md:transform-none md:w-96 md:flex md:flex-col md:shadow-none md:z-auto
                            screen-only
                            ${mobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                        `}>
                                <div className="p-4 bg-gray-50 border-b border-gray-200">
                                    <div className="flex justify-between items-center mb-3">
                                        <div>
                                            <h2 className="font-black text-lg text-gray-700 leading-none">ORDEM ATUAL</h2>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold mt-1">Venda de Balcão</p>
                                        </div>
                                        <button
                                            onClick={() => setMobileCartOpen(false)}
                                            className="md:hidden text-gray-400 hover:text-gray-600 p-2"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Nome do Cliente (Opcional)"
                                        className="w-full border-2 border-orange-200 bg-white p-2 rounded-lg text-sm font-bold focus:border-orange-500 focus:outline-none placeholder-gray-300"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {cart.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                                            Nenhum item selecionado
                                        </div>
                                    ) : (
                                        cart.map((item, idx) => (
                                            <div key={item.tempId} className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm transition-all">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-sm text-gray-800 line-clamp-1">{item.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="flex items-center bg-white border border-gray-200 rounded-md shadow-sm">
                                                                <button
                                                                    onClick={() => decreaseQty(item.tempId)}
                                                                    className="w-8 h-8 flex items-center justify-center text-red-500 font-bold hover:bg-red-50 active:bg-red-100 transition-colors"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="w-8 text-center text-xs font-black text-gray-700">
                                                                    {item.qty || 1}
                                                                </span>
                                                                <button
                                                                    onClick={() => increaseQty(item.tempId)}
                                                                    className="w-8 h-8 flex items-center justify-center text-green-600 font-bold hover:bg-green-50 active:bg-green-100 transition-colors"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                            <p className="text-xs text-green-600 font-bold ml-1">
                                                                R$ {(Number(item.price) * (item.qty || 1)).toFixed(2)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromCart(item.tempId)}
                                                        className="text-red-400 hover:text-red-600 p-1 bg-white rounded shadow-sm ml-2"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                {/* OBSERVAÇÃO POR ITEM */}
                                                <input
                                                    className="w-full border border-gray-200 bg-white p-2 rounded text-xs focus:border-orange-500 focus:outline-none placeholder-gray-300"
                                                    placeholder="Obs: Sem cebola, bem passado..."
                                                    value={item.observation || ""}
                                                    onChange={(e) => updateItemObservation(item.tempId, e.target.value)}
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="p-4 md:p-6 bg-gray-100 border-t border-gray-200 safe-bottom">
                                    {/* OBSERVAÇÃO GERAL */}
                                    <div className="mb-3 md:mb-4">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Observação Geral</label>
                                        <textarea
                                            className="w-full border border-gray-200 bg-white p-2 rounded text-xs focus:border-orange-500 focus:outline-none resize-none"
                                            rows={1}
                                            placeholder="Notas do pedido..."
                                            value={orderObservation}
                                            onChange={(e) => setOrderObservation(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center mb-4 md:mb-6">
                                        <span className="text-gray-600 font-bold text-sm">TOTAL</span>
                                        <span className="text-2xl md:text-3xl font-black text-gray-900">R$ {calculateTotal().toFixed(2)}</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            handleFinishOrder()
                                            setMobileCartOpen(false)
                                        }}
                                        className="w-full bg-green-600 text-white py-4 md:py-5 rounded-2xl font-black text-lg md:text-xl hover:bg-green-700 shadow-xl transition transform active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <span>✅</span> CONFIRMAR VENDA
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
                    )
                }

                {
                    activeTab === 'history' && (
                        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
                            {/* SELETOR DE DATA */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">📅 Relatórios</h2>
                                    <p className="text-xs text-gray-400 font-bold uppercase">Consulte o desempenho de qualquer dia</p>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <button
                                        onClick={() => setReportDate(new Date().toLocaleDateString('en-CA'))}
                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-black transition-all"
                                    >
                                        HOJE
                                    </button>
                                    <input
                                        type="date"
                                        value={reportDate}
                                        onChange={(e) => setReportDate(e.target.value)}
                                        className="flex-1 md:w-48 border-2 border-gray-200 p-2 rounded-lg font-bold text-gray-700 focus:border-blue-500 focus:outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* DESTAQUE DO DIA SELECIONADO */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 rounded-3xl shadow-xl border border-blue-500 flex flex-col md:flex-row items-center justify-between gap-6 text-white text-center md:text-left transition-all">
                                <div>
                                    <h3 className="text-blue-100 font-bold text-xs uppercase tracking-[0.2em] mb-2">
                                        {reportDate === new Date().toLocaleDateString('en-CA') ? 'Faturamento de Hoje' : `Vendas em ${new Date(reportDate + "T12:00:00").toLocaleDateString('pt-BR')}`}
                                    </h3>
                                    <p className="text-5xl font-black">
                                        R$ {dailyOrders
                                            .filter(o => new Date(o.created_at).toLocaleDateString('en-CA') === reportDate)
                                            .reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)
                                        }
                                    </p>
                                    <p className="text-blue-200 text-sm mt-2 font-medium">
                                        {dailyOrders.filter(o => new Date(o.created_at).toLocaleDateString('en-CA') === reportDate).length} pedidos realizados
                                    </p>
                                </div>
                                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20">
                                    <span className="text-3xl">📊</span>
                                </div>
                            </div>

                            {/* DETALHAMENTO DO DIA SELECIONADO */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">Minhas Vendas (Data)</h3>
                                    <p className="text-2xl font-black text-blue-600">
                                        R$ {dailyOrders
                                            .filter(o => o.cashier_name === user.name && new Date(o.created_at).toLocaleDateString('en-CA') === reportDate)
                                            .reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)
                                        }
                                    </p>
                                    <p className="text-[10px] text-gray-500 mt-1 font-bold">Processado por você</p>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">Vendas Totem (Data)</h3>
                                    <p className="text-2xl font-black text-orange-600">
                                        R$ {dailyOrders
                                            .filter(o => !o.cashier_name && new Date(o.created_at).toLocaleDateString('en-CA') === reportDate)
                                            .reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)
                                        }
                                    </p>
                                    <p className="text-[10px] text-gray-500 mt-1 font-bold">Autoatendimento</p>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">Total Geral (Semana)</h3>
                                    <p className="text-2xl font-black text-green-600">
                                        R$ {dailyOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)}
                                    </p>
                                    <p className="text-[10px] text-gray-500 mt-1 font-bold">Acumulado 7 dias buscados</p>
                                </div>
                            </div>

                            {/* HISTÓRICO DETALHADO — FILTRADO POR DATA */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Pedidos do Dia Selecionado</h2>
                                    <button onClick={loadDailyHistory} className="text-xs font-bold text-blue-600 hover:underline">Atualizar ↻</button>
                                </div>
                                <div className="overflow-x-auto hidden md:block">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black">
                                            <tr>
                                                <th className="p-4">Data/Hora</th>
                                                <th className="p-4">Origem</th>
                                                <th className="p-4">Itens</th>
                                                <th className="p-4 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {dailyOrders
                                                .filter(o => new Date(o.created_at).toLocaleDateString('en-CA') === reportDate)
                                                .map(order => (
                                                    <tr
                                                        key={order.id}
                                                        onClick={() => handleReprint(order)}
                                                        className="hover:bg-blue-50 transition-colors cursor-pointer group"
                                                        title="Clique para Reimprimir"
                                                    >
                                                        <td className="p-4 text-gray-500 font-mono text-[10px] leading-tight">
                                                            <span className="block font-bold text-gray-800">{new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                                            {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="p-4">
                                                            {order.cashier_name ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                                    <span className="text-[10px] font-black uppercase text-blue-900">{order.cashier_name}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                                                    <span className="text-[10px] font-black uppercase text-orange-900 font-mono tracking-tighter">🤖 TOTEM</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            <p className="text-xs font-bold truncate max-w-[200px] md:max-w-md group-hover:text-blue-700">
                                                                {order.items.map(i => `${i.qty}x ${i.name}`).join(", ")}
                                                            </p>
                                                            <span className="text-[9px] text-gray-400 font-mono">Pedido #{order.order_number}</span>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex flex-col items-end">
                                                                <span className="font-black text-gray-900 text-sm">R$ {Number(order.total).toFixed(2)}</span>
                                                                <span className="text-[8px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 uppercase tracking-tighter">🖨️ REIMPRIMIR</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* MOBILE VERSION OF HISTORY (CARD BASED) */}
                                <div className="md:hidden divide-y divide-gray-100">
                                    {dailyOrders
                                        .filter(o => new Date(o.created_at).toLocaleDateString('en-CA') === reportDate)
                                        .map(order => (
                                            <div
                                                key={order.id}
                                                onClick={() => handleReprint(order)}
                                                className="p-4 active:bg-blue-50 transition-colors"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="text-[10px] font-black text-blue-600 block mb-1">#{order.order_number}</span>
                                                        <span className="text-xs font-bold text-gray-800">
                                                            {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-gray-900">R$ {Number(order.total).toFixed(2)}</p>
                                                        {order.cashier_name ? (
                                                            <span className="text-[9px] font-black uppercase text-blue-500">👤 {order.cashier_name}</span>
                                                        ) : (
                                                            <span className="text-[9px] font-black uppercase text-orange-500">🤖 TOTEM</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-[11px] text-gray-500 line-clamp-2 italic">
                                                    {order.items.map(i => `${i.qty}x ${i.name}`).join(", ")}
                                                </p>
                                                <button className="w-full mt-3 py-2 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg uppercase tracking-widest border border-blue-100">
                                                    🖨️ REIMPRIMIR COMPROVANTE
                                                </button>
                                            </div>
                                        ))}
                                </div>

                                {dailyOrders.filter(o => new Date(o.created_at).toLocaleDateString('en-CA') === reportDate).length === 0 && (
                                    <div className="p-10 text-center text-gray-400 font-bold italic text-sm">Nenhum pedido encontrado nesta data.</div>
                                )}
                            </div>
                        </div>
                    )
                }
            </main >
        </div >
    )
}

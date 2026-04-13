import { useState, useEffect, useRef } from "react"
import { MapPin, User, Receipt, Clock, ShoppingCart } from "lucide-react"
import { productService, orderService, cashierService, configService } from "../services/api"
import { categories } from "../data/menu"
import logo from "../assets/herosburger.jpg"

const AUDIO_URL = "https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3"

export default function Cashier() {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem("cashier_user")
        return saved ? JSON.parse(saved) : null
    })
    const [loginUser, setLoginUser] = useState("")
    const [loginPass, setLoginPass] = useState("")
    const [activeTab, setActiveTab] = useState('pos')
    const [products, setProducts] = useState([])
    const [cart, setCart] = useState([])
    const [customerName, setCustomerName] = useState("")
    const [dailyOrders, setDailyOrders] = useState([])
    const [selectedCategory, setSelectedCategory] = useState("burgers")
    const [isPromoDay, setIsPromoDay] = useState(false)
    const [lastFinishedOrder, setLastFinishedOrder] = useState(null)
    const [mobileCartOpen, setMobileCartOpen] = useState(false)
    const [printerDevice, setPrinterDevice] = useState(null)
    const [printerStatus, setPrinterStatus] = useState("disconnected")
    const [selectedPizza, setSelectedPizza] = useState(null)
    const [selectingHalf, setSelectingHalf] = useState(null)
    const [firstFlavor, setFirstFlavor] = useState(null)
    const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-CA'))
    const [customerAddress, setCustomerAddress] = useState("")
    const [isPrinting, setIsPrinting] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState("") // 'dinheiro', 'cartao', 'pix'
    const [changeAmount, setChangeAmount] = useState("")
    const [selectedTableDetails, setSelectedTableDetails] = useState(null)
    const [tableLocks, setTableLocks] = useState({})

    // Helper robusto para identificar pedidos Cardápio Online, protegendo históricos antigos
    const checkIfOnlineOrder = (o) => {
        if (!o) return false;
        const pgtoMethod = (o.payment_method || o.paymentMethod || '').toLowerCase();
        const cNome = o.customer_name || o.customerName || '';
        const checkMesa = cNome.toLowerCase().startsWith('mesa');
        
        // Detecção nativa reforçada (Suporte a versões passadas do WhatsApp puro e novas com Pagamento Mapeado 'online_X'): 
        if (pgtoMethod === 'whatsapp' || pgtoMethod.startsWith('online_')) return true;

        return (!o.cashier_name && !o.cashierName && !checkMesa && cNome && !['totem', 'cartao', 'pix', 'dinheiro'].includes(pgtoMethod) && cNome !== 'Cliente' && cNome !== 'Totem');
    };

    // Helper robusto para extrair endereço, observação e nome limpo de clientes, mesmo em versões de banco muito antigas e novas com fallback de colchetes.
    const extractAddressAndObs = (order) => {
        if (!order) return { name: "Balcão", address: "", obs: "" };
        let cName = order.customer_name || order.customerName || "Balcão";
        let addr = order.customer_address || order.customerAddress || "";
        let obs = order.observation || order.observacao || "";

        // 1. Limpa Observações presas no Nome do Cliente (comum em fallbacks novos "[Obs: ]")
        const matchObsBracketsName = cName.match(/\[(?:Obs\.?|Observação|Observacao|Observaçoes|Complemento|Ref\.?|Referência|Referencia|Ponto de refer[eê]ncia|Detalhes):?\s*([^]]+)\]/i);
        if (matchObsBracketsName) {
            if (!obs) obs = matchObsBracketsName[1].trim();
            cName = cName.replace(/\[(?:Obs\.?|Observação|Observacao|Observaçoes|Complemento|Ref\.?|Referência|Referencia|Ponto de refer[eê]ncia|Detalhes):?\s*[^]]+\]/i, '').trim();
        }
        const matchObsTextName = cName.match(/(?:\s*-\s*|\s*\|\s*|\s+)?(?:Obs\.?|Observação|Observacao|Observaçoes|Complemento|Ref\.?|Referência|Referencia|Ponto de refer[eê]ncia|Detalhes):?\s*([\s\S]+?)$/i);
        if (matchObsTextName) {
            if (!obs) obs = matchObsTextName[1].trim();
            cName = cName.replace(/(?:\s*-\s*|\s*\|\s*|\s+)?(?:Obs\.?|Observação|Observacao|Observaçoes|Complemento|Ref\.?|Referência|Referencia|Ponto de refer[eê]ncia|Detalhes):?\s*([\s\S]+?)$/i, '').trim();
        }

        // 2. Extrai endereço preso no nome, caso exista
        if (cName.includes('(') && cName.includes(')')) {
            const matchNameAddr = cName.match(/\(([^)]+)\)/);
            if (matchNameAddr && !addr) addr = matchNameAddr[1].trim();
            cName = cName.replace(/\([^)]+\)/, '').trim();
        }

        // 3. Verifica se há indicação de observação/complemento engolida pelo próprio endereço
        const regexAddressObs = /(?:\s*-\s*|\s*\|\s*|\s*\(\s*|\s*\[\s*|\s+)?(?:Obs\.?|Observação|Observacao|Observaçoes|Complemento|Ref\.?|Referência|Referencia|Ponto de refer[eê]ncia|Detalhes):?\s*([\s\S]+?)(?:\)|\]|$)/i;
        const matchAddrObs = addr.match(regexAddressObs);
        if (matchAddrObs) {
            obs = (obs ? obs + " | " : "") + matchAddrObs[1].trim();
            addr = addr.replace(regexAddressObs, '').trim();
        }

        // 4. Limpezas finais globais (Tira colchetes/traços soltos que ficaram para trás nos cantos)
        cName = cName.replace(/\[\s*\]/g, '').replace(/\[\s*$/, '').trim();
        addr = addr.replace(/\[\s*$/, '').replace(/-\s*$/, '').trim();
        obs = obs.replace(/\]\s*$/, '').trim();

        return { name: cName, address: addr, obs: obs };
    };

    // Refs para controle de áudio (Igual Cozinha)
    const knownIds = useRef(new Set())
    const isFirstLoad = useRef(true)
    const prevTableLocks = useRef({})

    // Verifica se já existe uma impressora pareada ao carregar
    useEffect(() => {
        const checkPairedDevices = async () => {
            if (navigator.bluetooth?.getDevices) {
                try {
                    const devices = await navigator.bluetooth.getDevices();
                    if (devices.length > 0) {
                        setPrinterStatus("ready");
                    }
                } catch (e) {
                    console.log("Erro ao verificar dispositivos pareados:", e);
                }
            }
        };
        checkPairedDevices();
    }, []);

    // Sound Alert Helper (Robust)
    const playBeepFallback = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const playNote = (freq, startTime, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.3, startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };
            const now = ctx.currentTime;
            playNote(880, now, 0.3); // A5
            playNote(659, now + 0.2, 0.6); // E5
        } catch (e) {
            console.error("Erro no som de fallback:", e);
        }
    }

    const playNotification = () => {
        const audio = new Audio(AUDIO_URL)
        audio.volume = 1.0
        audio.play().catch(e => {
            console.log("MP3 falhou/bloqueado. Tentando beep nativo...", e)
            playBeepFallback()
        })
    }

    // Sound Logic - Robust & Centralized
    const processAudioForOrders = (ordersList) => {
        if (!user.can_view_reports) return

        let shouldPlay = false
        ordersList.forEach(order => {
            if (!knownIds.current.has(order.id)) {
                knownIds.current.add(order.id)

                // Ignora sons na primeira carga massiva da tela
                if (isFirstLoad.current) return

                // Critérios: Sem operador (Totem/Mesa) + Pendente
                const isExternal = !order.cashier_name
                const isPending = order.status === 'pending'

                if (isExternal && isPending) {
                    console.log(`🔊 Som detectado para pedido #${order.order_number}`)
                    shouldPlay = true
                }
            }
        })

        if (shouldPlay) {
            playNotification()
        }
    }

    useEffect(() => {
        configService.getSettings().then(data => {
            const promoDaysConfig = data.find(c => c.key === 'promo_days')
            let promoDays = [1, 2, 3, 4, 5]
            if (promoDaysConfig) {
                try { promoDays = JSON.parse(promoDaysConfig.value) } catch (e) {}
            }
            const isPromo = promoDays.includes(new Date().getDay())
            setIsPromoDay(isPromo)
            if (isPromo) setSelectedCategory("promocoes")
        })
    }, [])

    useEffect(() => {
        if (user) {
            // Expor para teste
            window.playTestSound = playNotification

            // Carregamento inicial
            loadProducts()
            loadDailyHistory().then(() => {
                isFirstLoad.current = false // Libera o som após primeira carga
            })

            // Backup Polling (a cada 15s) para garantir sincronia
            const polling = setInterval(() => {
                loadDailyHistory(true) // Passa flag silent
            }, 10000)

            // Subscribe to realtime orders
            const subscription = orderService.subscribeToOrders((payload) => {
                const { eventType, new: newOrder, old: oldOrder } = payload

                setDailyOrders(prevOrders => {
                    let updatedList = [...prevOrders]

                    if (eventType === 'INSERT') {
                        if (updatedList.some(o => o.id === newOrder.id)) return updatedList

                        // Processa Som Instantâneo
                        processAudioForOrders([newOrder])

                        updatedList.unshift(newOrder)
                    }
                    else if (eventType === 'UPDATE') {
                        updatedList = updatedList.map(o => o.id === newOrder.id ? newOrder : o)
                    }
                    else if (eventType === 'DELETE') {
                        updatedList = updatedList.filter(o => o.id !== oldOrder.id)
                    }

                    return updatedList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                })
            })

            const handleAfterPrint = () => setLastFinishedOrder(null)
            window.addEventListener('afterprint', handleAfterPrint)

            return () => {
                if (subscription) subscription.unsubscribe()
                clearInterval(polling)
                window.removeEventListener('afterprint', handleAfterPrint)
            }
        }
    }, [user, activeTab, printerStatus])

    const loadProducts = async () => {
        const data = await productService.getProducts()
        setProducts(data)
    }

    const fetchTableLocks = async () => {
        try {
            const settings = await configService.getSettings()
            const locks = {}
            const now = Date.now()
            settings.forEach(s => {
                if (s.key && s.key.startsWith('lock_mesa_')) {
                    try {
                        const val = JSON.parse(s.value)
                        if (now - val.ts < 90000) { // 90 segundos de tolerância de inatividade
                            locks[s.key.replace('lock_mesa_', '')] = true
                        }
                    } catch(e){}
                }
            })

            // Lógica do bip para nova mesa ocupada (lendo cardápio)
            let hasNewLock = false
            Object.keys(locks).forEach(tableNum => {
                if (!prevTableLocks.current[tableNum]) {
                    hasNewLock = true
                }
            })
            if (hasNewLock && !isFirstLoad.current) {
                playNotification()
            }
            prevTableLocks.current = locks

            setTableLocks(locks)
        } catch(e) {}
    }

    const loadDailyHistory = async (isPolling = false) => {
        fetchTableLocks()
        const now = new Date()
        let orders;

        if (user.can_view_reports) {
            // Traz apenas últimos 7 dias para visualização leve no caixa
            const sevenDaysAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
            const endIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
            orders = await orderService.getOrders(sevenDaysAgoIso, endIso)
        } else {
            const startIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString()
            const endIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
            orders = await orderService.getOrders(startIso, endIso)
        }

        const rawOrders = Array.isArray(orders) ? orders : []

        // Processa som (se houver novos ids detectados pelo polling)
        processAudioForOrders(rawOrders)

        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0)

        const finalOrders = rawOrders.filter(o => {
            if (user.can_view_reports) {
                if (!o.created_at) return true
                return new Date(o.created_at) >= sevenDaysAgo
            } else {
                return o.cashier_name === user.name
            }
        })

        finalOrders.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at) : new Date()
            const dateB = b.created_at ? new Date(b.created_at) : new Date()
            return dateB - dateA
        })

        setDailyOrders(finalOrders)
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
                    acceptAllDevices: true,
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
                setPrinterStatus("ready");
                setPrinterDevice(null);
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

    const printBluetooth = async (isManual = false, orderToPrint = null) => {
        let activeDevice = printerDevice;

        // Se manual e não tiver dispositivo, abre o seletor nativo
        if (!activeDevice) {
            activeDevice = await connectPrinter(!isManual);
        }

        const order = orderToPrint || lastFinishedOrder;
        if (!activeDevice || !order) return false;

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

            const isOnline = checkIfOnlineOrder(order);
            const { name: finalName, address: finalAddress, obs: finalObs } = extractAddressAndObs(order);

            let data = new Uint8Array([
                ...INIT, ...CENTER, ...BOLD_ON, ...DOUBLE_ON, ...txt("HERO'S BURGER"), ...DOUBLE_OFF,
                ...txt("CONTROLE DE PEDIDO"),
                ...BOLD_ON, ...txt(`OPERADOR: ${order.cashierName || 'GERAL'}`), ...BOLD_OFF,
                ...txt(`NR: ${order.orderNumber}`),
                ...txt(`DATA: ${new Date(order.created_at || Date.now()).toLocaleDateString('pt-BR')}`),
                ...txt(`HORA: ${new Date(order.created_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`),
                ...txt("--------------------------------"),
                ...LEFT,
                ...(isOnline ? [...CENTER, ...BOLD_ON, ...txt("CARDAPIO ONLINE"), ...BOLD_OFF, ...LEFT, ...txt("--------------------------------")] : []),
                ...txt(`Cliente: ${finalName}`),
                ...((order.customer_address || order.customerAddress)
                    ? [...BOLD_ON, ...txt(`ENTREGA: ${finalAddress}`), ...BOLD_OFF]
                    : []),
                ...(finalObs
                    ? [...BOLD_ON, ...txt(`COMPLEMENTO: ${finalObs}`), ...BOLD_OFF]
                    : []),
                ...((order.paymentMethod || order.payment_method)
                    ? [...txt(`PAGAMENTO: ${(order.paymentMethod || order.payment_method).replace('online_', '').toUpperCase()}`)]
                    : []),
                ...txt("--------------------------------"),
            ]);

            order.items.forEach(item => {
                const qty = `${item.qty}x `;
                const price = (Number(item.price) * item.qty).toFixed(2);
                const totalWidth = 32;
                const name = item.name;

                if (isOnline) {
                    data = new Uint8Array([
                        ...data,
                        ...BOLD_ON, ...txt(`${qty}${name}`), ...BOLD_OFF,
                        ...txt(`R$ ${price}`)
                    ]);
                    if (item.observation) data = new Uint8Array([...data, ...txt(`  Obs: ${item.observation}`)]);
                } else {
                    // Se o nome couber na mesma linha com qty e price
                    if (qty.length + name.length + price.length + 1 <= totalWidth) {
                        const dotsCount = totalWidth - qty.length - name.length - price.length;
                        const dots = dotsCount > 0 ? ".".repeat(dotsCount) : " ";
                        data = new Uint8Array([...data, ...txt(`${qty}${name}${dots}${price}`)]);
                    } else {
                        // Nome longo: imprime o nome completo (quebra automática na impressora)
                        // e o preço na linha de baixo alinhado à direita
                        data = new Uint8Array([...data, ...txt(`${qty}${name}`)]);
                        const dotsCount = totalWidth - price.length;
                        const dots = dotsCount > 0 ? ".".repeat(dotsCount) : " ";
                        data = new Uint8Array([...data, ...txt(`${dots}${price}`)]);
                    }
                    if (item.observation) data = new Uint8Array([...data, ...txt(`  > ${item.observation}`)]);
                }

                // Espaçamento extra entre itens
                data = new Uint8Array([...data, ...txt("")]);
            });

            if (order.change_amount || order.changeAmount) {
                const changeVal = Number(order.change_amount || order.changeAmount);
                const totalVal = Number(order.total);
                const troco = changeVal - totalVal;
                if (troco > 0) {
                    data = new Uint8Array([
                        ...data,
                        ...BOLD_ON, ...txt(`PAGOU: R$ ${changeVal.toFixed(2)}`),
                        ...txt(`TROCO: ${troco.toFixed(2)}`), ...BOLD_OFF,
                        ...txt("--------------------------------")
                    ]);
                }
            }

            data = new Uint8Array([
                ...data,
                ...txt("--------------------------------"),
                ...BOLD_ON, ...txt(`TOTAL: R$ ${Number(order.total).toFixed(2)}`), ...BOLD_OFF,
                ...txt("--------------------------------")
            ]);

            // Obs foi movida para o cabeçalho como complemento do endereço

            data = new Uint8Array([
                ...data,
                ...CENTER, ...txt("\nObrigado pela preferencia!"), ...txt("\n"), ...FEED
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


            // DESCONECTA APÓS IMPRIMIR
            // Isso é essencial para que outros caixas possam usar a mesma impressora, 
            // já que ela só aceita uma conexão Bluetooth ativa por vez através do site.
            if (activeDevice.service?.device?.gatt?.connected) {
                console.log("Desconectando para liberar para outros dispositivos...");
                activeDevice.service.device.gatt.disconnect();
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
        let cName = order.customer_name || order.customerName || "Balcão";
        let cAddr = order.customer_address || order.customerAddress || "";
        let cObs = order.observation || "";

        // 1. Limpa e desmembra observação em formatação de colchetes (ex: "João [Obs: sem cebola]")
        const matchObsBrackets = cName.match(/\[(?:Obs\.?|Observação|Observacao|Observaçoes|Complemento|Ref\.?|Referência|Referencia|Ponto de refer[eê]ncia|Detalhes):?\s*([^]]+)\]/i);
        if (matchObsBrackets) {
            if (!cObs) cObs = matchObsBrackets[1].trim();
            cName = cName.replace(/\[(?:Obs\.?|Observação|Observacao|Observaçoes|Complemento|Ref\.?|Referência|Referencia|Ponto de refer[eê]ncia|Detalhes):?\s*[^]]+\]/i, '').trim();
        }
        
        // Limpeza de brackets genéricos que possam estar vazios ou não capturados (opcional/safety)
        // cName = cName.replace(/\[\s*\]/g, '').trim();

        // 2. Limpa e desmembra parênteses de endereço (ex: "João (Rua X)")
        if (cName.includes('(') && cName.includes(')')) {
            const matchAddr = cName.match(/\(([^)]+)\)/);
            if (matchAddr && !cAddr) cAddr = matchAddr[1].trim();
            cName = cName.replace(/\([^)]+\)/, '').trim();
        }

        // 3. Caso a observação não estivesse em colchetes e tenha sobrado no nome de forma solta (ex: "João - Complemento: Trazer troco")
        const matchObsText = cName.match(/(?:\s*-\s*|\s*\|\s*|\s+)?(?:Obs\.?|Observação|Observacao|Observaçoes|Complemento|Ref\.?|Referência|Referencia|Ponto de refer[eê]ncia|Detalhes):?\s*([\s\S]+?)$/i);
        if (matchObsText) {
            if (!cObs) cObs = matchObsText[1].trim();
            cName = cName.replace(/(?:\s*-\s*|\s*\|\s*|\s+)?(?:Obs\.?|Observação|Observacao|Observaçoes|Complemento|Ref\.?|Referência|Referencia|Ponto de refer[eê]ncia|Detalhes):?\s*([\s\S]+?)$/i, '').trim();
        }

        // Criamos o objeto de reimpressão
        const reprintData = {
            ...order,
            orderNumber: order.order_number || order.orderNumber,
            cashierName: order.cashier_name || order.cashierName || null,
            customerName: cName || "Balcão",
            customerAddress: cAddr,
            paymentMethod: order.payment_method || order.paymentMethod || "",
            changeAmount: order.change_amount || order.changeAmount || null,
            observation: cObs
        }
        setLastFinishedOrder(reprintData)
    }
    const handleLogin = async (e) => {
        e.preventDefault()
        try {
            const cashier = await cashierService.login(loginUser, loginPass)
            if (cashier) {
                setUser(cashier)
                localStorage.setItem("cashier_user", JSON.stringify(cashier))
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
            observation: "", // Deixando vago para não repetir no endereço
            customerAddress: customerAddress,
            paymentMethod: paymentMethod, // Novo campo
            changeAmount: paymentMethod === 'dinheiro' && changeAmount ? changeAmount : null
        }

        const { data: savedOrder, error } = await orderService.createOrder(orderPayload)

        if (error || !savedOrder) {
            const msg = error?.message || "Erro desconhecido"
            alert(`❌ ERRO AO GRAVAR NO BANCO!\n\nO servidor disse: "${msg}"\n\nVerifique se a tabela 'orders' existe e se você tem permissão de acesso.`)
            return
        }

        // Atualiza estado e limpa carrinho
        // Usamos o savedOrder do banco para garantir que temos o ID real e dados finais
        const finalOrder = {
            ...orderPayload,
            id: savedOrder.id,
            created_at: savedOrder.created_at
        }

        setLastFinishedOrder(finalOrder)
        setCart([])
        setCustomerName("")
        setCustomerAddress("")
        setPaymentMethod("") // Limpa o método de pagamento
        setChangeAmount("")
        loadDailyHistory()

        // AUTO-PRINT: Tenta imprimir se houver uma impressora configurada/pronta
        if (printerStatus === 'connected' || printerStatus === 'ready') {
            setTimeout(() => printBluetooth(false, finalOrder), 500)
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

    // Reatividade em Tempo Real para o Modal de Mesas
    const activeModalTableNum = selectedTableDetails?.tableNum;
    const activeModalOrders = activeModalTableNum ? dailyOrders.filter(o => {
        const cName = o.customer_name?.toLowerCase() || '';
        const tName = `mesa ${activeModalTableNum}`.toLowerCase();
        return (cName === tName || cName.startsWith(`${tName} `) || cName.startsWith(`${tName}[`)) && 
               !['finished', 'archived'].includes(o.status);
    }) : [];
    const activeModalIsOnlyLocked = activeModalTableNum ? (activeModalOrders.length === 0) : false;
    const activeModalTableTotal = activeModalOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

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
                    {/* TESTE DE SOM */}
                    <button
                        onClick={playNotification}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-900/50 bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 transition-all font-bold text-xs"
                        title="Testar alerta sonoro"
                    >
                        🔊 <span className="hidden md:inline">TESTAR SOM</span>
                    </button>

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
                            {printerStatus === 'connected' ? 'CONECTADO' :
                                printerStatus === 'connecting' ? 'BUSCANDO...' :
                                    printerStatus === 'ready' ? 'PRONTA' : 'OFF'}
                        </span>
                        {(printerStatus === 'connected' || printerStatus === 'ready') && (
                            <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] ${printerStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-green-500/50'}`}></span>
                        )}
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
                            onClick={() => setActiveTab('tables')}
                            className={`px-3 md:px-6 py-2 rounded-md text-xs md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'tables' ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            🍽️ MESAS
                        </button>
                        <button
                            onClick={() => window.open("/kitchen", "_blank")}
                            className="px-3 md:px-6 py-2 rounded-md text-xs md:text-sm font-bold transition whitespace-nowrap text-gray-400 hover:text-orange-400"
                        >
                            🧑‍🍳 COZINHA
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            setUser(null)
                            localStorage.removeItem("cashier_user")
                        }}
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

                        {/* COMPROVANTE (VISÍVEL PARA PREVIEW) */}
                        <div id="receipt" className="print:block border-t border-dashed border-gray-200 pt-4">
                            <div className="text-black bg-white font-mono text-xs leading-tight">
                                <div className="text-center mb-4">
                                    <h2 className="text-xl font-black uppercase">Hero's Burger</h2>
                                    <p className="text-xs">Rua Antonio moreira, 123</p>
                                    <p className="text-xs">CNPJ: 48.507.205/0001-94</p>
                                    <p className="text-xs">TEL: (63) 99103-8781</p>
                                </div>
                                <div className="border-b border-black border-dashed my-2"></div>
                                <div className="flex justify-center gap-2 text-xs font-mono">
                                    <span>#{lastFinishedOrder.orderNumber}</span>
                                    <span>•</span>
                                    <span>{new Date(lastFinishedOrder.created_at || Date.now()).toLocaleDateString('pt-BR')}</span>
                                    <span>•</span>
                                    <span>{new Date(lastFinishedOrder.created_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="flex flex-col items-center gap-1 mt-2">
                                    <div className="text-[10px] font-black bg-black text-white px-4 py-1.5 rounded-full inline-block uppercase tracking-widest">
                                        Operador: {lastFinishedOrder.cashierName}
                                    </div>
                                </div>
                                <div className="text-xs mb-1 uppercase font-bold">
                                    Cliente: {extractAddressAndObs(lastFinishedOrder).name}
                                </div>
                                {extractAddressAndObs(lastFinishedOrder).address && (
                                    <div className="text-[10px] mb-2 uppercase border border-black p-1 bg-gray-50">
                                        <strong>ENTREGA:</strong> {extractAddressAndObs(lastFinishedOrder).address}
                                    </div>
                                )}
                                {extractAddressAndObs(lastFinishedOrder).obs && (
                                    <div className="text-[10px] mt-[-4px] mb-2 uppercase border border-black p-1 bg-gray-50 flex">
                                        <strong>COMPLEMENTO:</strong> <span className="ml-1">{extractAddressAndObs(lastFinishedOrder).obs}</span>
                                    </div>
                                )}
                                {checkIfOnlineOrder(lastFinishedOrder) && (
                                    <div className="text-center py-1 bg-green-50 text-[10px] font-black text-green-700 border-y border-green-200 mb-2">
                                        CARDÁPIO ONLINE
                                    </div>
                                )}
                                {(() => {
                                    const pgto = lastFinishedOrder?.paymentMethod || lastFinishedOrder?.payment_method;
                                    if (!pgto) return null;
                                    const displayPgto = pgto.replace('online_', '');
                                    return (
                                        <>
                                            <div className="my-2 p-1 border-2 border-black text-center font-bold text-sm uppercase">
                                                PAGAMENTO: {displayPgto.toUpperCase()}
                                            </div>
                                            {/* Add more line feeds for Bluetooth print */}
                                            <div className="h-4"></div>
                                        </>
                                    );
                                })()}
                                <div className="border-b border-black border-dashed my-2"></div>
                                {/* RENDERING ITENS */}
                                {(() => {
                                    const isOnlineRec = checkIfOnlineOrder(lastFinishedOrder);

                                    if (isOnlineRec) {
                                        return (
                                            <div className="space-y-4 mb-4">
                                                {(lastFinishedOrder.items || []).map((item, i) => (
                                                    <div key={i} className="border-b border-black border-dotted pb-2 last:border-0 font-bold">
                                                        <div className="text-sm uppercase">{item.qty}x {item.name}</div>
                                                        <div className="flex justify-between items-center text-[10px] italic text-gray-700">
                                                            <span>R$ {(Number(item.price) * (item.qty || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                            {item.observation && (
                                                                <span className="bg-gray-100 px-1 rounded not-italic font-black text-black border border-black/10">
                                                                    Obs: {item.observation}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    }
                                    return (
                                        <>
                                            <div className="border-b border-black border-dashed my-2"></div>
                                            <table className="w-full text-left mb-4">
                                                <thead>
                                                    <tr className="text-xs border-b border-dashed border-black">
                                                        <th className="py-1 w-[10%]">Qtd</th>
                                                        <th className="py-1 w-[65%]">Item</th>
                                                        <th className="py-1 w-[25%] text-right">Preço</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(lastFinishedOrder.items || []).map((item, i) => (
                                                        <tr key={i} className="border-b border-black border-dashed last:border-0 font-bold">
                                                            <td className="py-3 align-top w-6">{item.qty}x</td>
                                                            <td className="py-3 align-top">
                                                                <div className="leading-tight break-words uppercase">{item.name}</div>
                                                                {item.observation && <div className="text-[10px] italic mt-1 font-normal">➔ {item.observation}</div>}
                                                            </td>
                                                            <td className="py-3 align-top text-right whitespace-nowrap pl-2">
                                                                {(Number(item.price) * (item.qty || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </>
                                    );
                                })()}
                                {lastFinishedOrder.changeAmount && (
                                    <div className="border-t border-black border-dashed pt-2 my-2 text-sm font-bold">
                                        <div className="flex justify-between">
                                            <span>TROCO PARA:</span>
                                            <span>R$ {Number(lastFinishedOrder.changeAmount).toFixed(2)}</span>                                        </div>
                                        <div className="flex justify-between text-lg">
                                            <span>VALOR:</span>
                                            <span>{(Number(lastFinishedOrder.changeAmount) - Number(lastFinishedOrder.total)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        </div>
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
                                {/* Add more line feeds for Bluetooth print */}
                                <div className="h-8"></div>
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
                                    {categories.filter(cat => cat.id !== 'promocoes' || isPromoDay).map(cat => (
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
                                                <div className="h-20 md:h-24 w-full bg-gray-100 rounded mb-2 overflow-hidden">
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
                                            <p className="text-[10px] text-gray-400 uppercase font-bold mt-1">
                                                Venda de Balcão — <span className="text-orange-600">👤 {user.name}</span>
                                            </p>
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
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Endereço (Entrega)</label>
                                        <textarea
                                            className="w-full border border-gray-200 bg-white p-2 rounded text-xs focus:border-orange-500 focus:outline-none resize-none"
                                            rows={1}
                                            placeholder="Rua, número, bairro..."
                                            value={customerAddress}
                                            onChange={(e) => setCustomerAddress(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center mb-4 md:mb-6">
                                        <span className="text-gray-600 font-bold text-sm">TOTAL</span>
                                        <span className="text-2xl md:text-3xl font-black text-gray-900">R$ {calculateTotal().toFixed(2)}</span>
                                    </div>

                                    {/* FORMA DE PAGAMENTO (OBRIGATÓRIO) */}
                                    <div className="mb-6 space-y-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Forma de Pagamento</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: 'dinheiro', label: '💵 Dinheiro' },
                                                { id: 'cartao', label: '💳 Cartão' },
                                                { id: 'pix', label: '💎 PIX' }
                                            ].map(method => (
                                                <button
                                                    key={method.id}
                                                    onClick={() => setPaymentMethod(method.id)}
                                                    className={`
                                                        py-3 rounded-xl text-xs font-black transition-all border-2
                                                        ${paymentMethod === method.id
                                                            ? 'bg-orange-600 border-orange-600 text-white shadow-lg scale-105'
                                                            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}
                                                    `}
                                                >
                                                    {method.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* OPÇÃO DE TROCO (Apenas se for dinheiro) */}
                                    {paymentMethod === 'dinheiro' && (
                                        <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="block text-[10px] font-black text-orange-600 uppercase mb-2 tracking-widest">Troco para quanto?</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
                                                <input
                                                    type="number"
                                                    placeholder="Valor entregue pelo cliente"
                                                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-orange-200 rounded-xl font-black text-gray-800 focus:border-orange-500 focus:outline-none placeholder-gray-300"
                                                    value={changeAmount}
                                                    onChange={(e) => setChangeAmount(e.target.value)}
                                                />
                                            </div>
                                            <p className="text-[9px] text-orange-400 mt-2 font-bold italic">Deixe vazio se não houver troco</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            handleFinishOrder()
                                            setMobileCartOpen(false)
                                        }}
                                        disabled={!paymentMethod}
                                        className={`
                                            w-full py-4 md:py-5 rounded-2xl font-black text-lg md:text-xl shadow-xl transition transform flex items-center justify-center gap-2
                                            ${paymentMethod
                                                ? 'bg-green-600 text-white hover:bg-green-700 active:scale-95 cursor-pointer'
                                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                                        `}
                                    >
                                        <span>✅</span> {paymentMethod ? 'CONFIRMAR VENDA' : 'SELECIONE O PAGAMENTO'}
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
                            {/* FILTRO DE DATA — APENAS SE TIVER PERMISSÃO */}
                            {user.can_view_reports && (
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                                    <div className="flex flex-col gap-1">
                                        <h2 className="text-sm font-black text-gray-800 uppercase tracking-tighter">Filtrar Histórico</h2>
                                        <p className="text-[10px] text-gray-400 font-bold">Consulte vendas de outros dias e do Totem</p>
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
                            )}

                            {/* DESTAQUE DO DIA SELECIONADO — APENAS SE TIVER PERMISSÃO */}
                            {user.can_view_reports && (
                                <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 rounded-3xl shadow-xl border border-blue-500 flex flex-col md:flex-row items-center justify-between gap-6 text-white text-center md:text-left transition-all mb-8">
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
                            )}

                            {/* STATS CARDS — RESUMO DINÂMICO BASEADO NA PERMISSÃO */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                {/* CARD 1: SEU RESULTADO (Sempre visível) */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
                                    <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">Suas Vendas (Hoje)</h3>
                                    <p className="text-2xl font-black text-blue-600">
                                        R$ {dailyOrders
                                            .filter(o => o.cashier_name === user.name && new Date(o.created_at).toLocaleDateString('en-CA') === (user.can_view_reports ? reportDate : new Date().toLocaleDateString('en-CA')))
                                            .reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)
                                        }
                                    </p>
                                    <p className="text-[10px] text-gray-500 mt-1 font-bold italic">Processado por você</p>
                                </div>

                                {/* CARDS ADICIONAIS: APENAS SE AUTORIZADO (VISÃO DE GERENTE) */}
                                {user.can_view_reports && (
                                    <>
                                        {/* CARD 2: CARDÁPIO ONLINE */}
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-500">
                                            <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">Cardápio Online</h3>
                                            <p className="text-2xl font-black text-green-600">
                                                R$ {dailyOrders
                                                    .filter(o => {
                                                        const pgtoMethod = (o.payment_method || o.paymentMethod || "").toLowerCase();
                                                        const isMesa = o.customer_name?.toLowerCase().startsWith('mesa');
                                                        const isOnline = checkIfOnlineOrder(o);
                                                        return isOnline && new Date(o.created_at).toLocaleDateString('en-CA') === (user.can_view_reports ? reportDate : new Date().toLocaleDateString('en-CA'));
                                                    })
                                                    .reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)
                                                }
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1 font-bold italic">Vendas Cardápio Online</p>
                                        </div>

                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-orange-500">
                                            <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">Totem (Autoatendimento)</h3>
                                            <p className="text-2xl font-black text-orange-600">
                                                R$ {dailyOrders
                                                    .filter(o => {
                                                        const pgtoMethod = (o.payment_method || o.paymentMethod || "").toLowerCase();
                                                        const isMesa = o.customer_name?.toLowerCase().startsWith('mesa');
                                                        const isOnline = checkIfOnlineOrder(o);
                                                        const isTotem = !o.cashier_name && !isOnline && !isMesa;
                                                        return isTotem && new Date(o.created_at).toLocaleDateString('en-CA') === reportDate;
                                                    })
                                                    .reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)
                                                }
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1 font-bold italic">Vendas no Balcão</p>
                                        </div>

                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-teal-500">
                                            <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">Mesas (QR Code)</h3>
                                            <p className="text-2xl font-black text-teal-600">
                                                R$ {dailyOrders
                                                    .filter(o => !o.cashier_name && o.customer_name?.toLowerCase().startsWith('mesa') && new Date(o.created_at).toLocaleDateString('en-CA') === reportDate)
                                                    .reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)
                                                }
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1 font-bold italic">Pedidos via Celular</p>
                                        </div>

                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500">
                                            <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">Outros Operadores</h3>
                                            <p className="text-2xl font-black text-purple-600">
                                                R$ {dailyOrders
                                                    .filter(o => o.cashier_name && o.cashier_name !== user.name && new Date(o.created_at).toLocaleDateString('en-CA') === reportDate)
                                                    .reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)
                                                }
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1 font-bold italic">Vendas de outros caixas</p>
                                        </div>

                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-600">
                                            <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">Total Geral (Dia)</h3>
                                            <p className="text-2xl font-black text-green-700">
                                                R$ {dailyOrders
                                                    .filter(o => new Date(o.created_at).toLocaleDateString('en-CA') === reportDate)
                                                    .reduce((acc, o) => acc + (Number(o.total) || 0), 0).toFixed(2)
                                                }
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1 font-bold italic">Soma de todas as fontes</p>
                                        </div>
                                    </>
                                )}

                                {/* SE NÃO AUTORIZADO: MOSTRA QTD DE PEDIDOS SIMPLES */}
                                {!user.can_view_reports && (
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">Seus Pedidos (Hoje)</h3>
                                        <p className="text-2xl font-black text-gray-800">
                                            {dailyOrders.filter(o => o.cashier_name === user.name).length}
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-1 font-bold italic">Sua quantidade de hoje</p>
                                    </div>
                                )}
                            </div>

                            {/* HISTÓRICO DETALHADO — APENAS HOJE */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">
                                        {user.can_view_reports ? 'Histórico Geral de Vendas' : 'Suas Vendas de Hoje'}
                                    </h2>
                                    <div className="flex items-center gap-4">
                                        <button onClick={loadDailyHistory} className="text-xs font-bold text-blue-600 hover:underline">Atualizar ↻</button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto hidden md:block">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black">
                                            <tr>
                                                <th className="p-4">Data/Hora</th>
                                                <th className="p-4">Cliente / Origem</th>
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
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <User size={12} className="text-gray-400" />
                                                                    <span className="text-sm font-bold text-gray-800">{extractAddressAndObs(order).name || "Cliente"}</span>
                                                                </div>

                                                                {order.cashier_name ? (
                                                                    <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 rounded-full w-fit border border-blue-100">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></span>
                                                                        <span className="text-[9px] font-black uppercase text-blue-900 tracking-tighter">Caixa: {order.cashier_name}</span>
                                                                    </div>
                                                                ) : order.customer_name?.toLowerCase().startsWith('mesa') ? (
                                                                    <div className="flex items-center gap-1.5 bg-teal-50 px-2 py-0.5 rounded-full w-fit border border-teal-100">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                                                                        <span className="text-[9px] font-black uppercase text-teal-900 font-mono tracking-tighter">📱 MESA (QR)</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full w-fit border border-gray-100">
                                                                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${(() => {
                                                                            const isOnline = checkIfOnlineOrder(order);
                                                                            return isOnline ? 'bg-green-500' : 'bg-orange-500';
                                                                        })()}`}></span>
                                                                        <span className="text-[9px] font-black uppercase text-gray-500 tracking-tighter">
                                                                            {(() => {
                                                                                const isOnline = checkIfOnlineOrder(order);
                                                                                return isOnline ? '📱 CARDÁPIO ONLINE' : '🤖 TOTEM';
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {extractAddressAndObs(order).address && (
                                                                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-100 w-fit">
                                                                        <MapPin size={10} className="text-red-400" />
                                                                        <span className="truncate max-w-[150px]">{extractAddressAndObs(order).address}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <p className="text-xs font-bold truncate max-w-[200px] md:max-w-md group-hover:text-blue-700">
                                                                {order.items.map(i => `${i.qty}x ${i.name}`).join(", ")}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[9px] text-gray-400 font-mono">Pedido #{order.order_number}</span>
                                                                {order.payment_method && (
                                                                    <span className="text-[8px] bg-gray-100 text-gray-600 px-1 rounded font-black uppercase border border-gray-200">
                                                                        {order.payment_method.replace('online_', '')}
                                                                    </span>
                                                                )}
                                                            </div>
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
                                                        <span className="text-sm font-black text-gray-900 block mb-1 uppercase tracking-tighter">
                                                            {order.customer_name || "Cliente"}
                                                        </span>
                                                        <span className="text-xs font-bold text-gray-400">
                                                            {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-gray-900">R$ {Number(order.total).toFixed(2)}</p>
                                                        {order.cashier_name ? (
                                                            <span className="text-[9px] font-black uppercase text-blue-500">👤 {order.cashier_name}</span>
                                                        ) : order.customer_name?.toLowerCase()?.startsWith('mesa') ? (
                                                            <span className="text-[9px] font-black uppercase text-teal-500">📱 MESA</span>
                                                        ) : (() => {
                                                            const isOnline = checkIfOnlineOrder(order);
                                                            return isOnline ? (
                                                                <span className="text-[9px] font-black uppercase text-green-500">📱 CARDÁPIO</span>
                                                            ) : (
                                                                <span className="text-[9px] font-black uppercase text-orange-500">🤖 TOTEM</span>
                                                            );
                                                        })()}
                                                    </div>
                                                    {order.customer_address && (
                                                        <div className="mt-2 text-[11px] text-orange-900 bg-orange-50 p-2.5 rounded-xl border border-orange-100 flex items-center gap-2 shadow-sm font-bold">
                                                            <MapPin size={14} className="text-orange-600 shrink-0" />
                                                            <span className="line-clamp-2 leading-tight">{order.customer_address}</span>
                                                        </div>
                                                    )}
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

                {
                    activeTab === 'tables' && (
                        <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto bg-gray-50">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Gestão de Mesas</h2>
                                    <p className="text-sm text-gray-500 font-bold mt-1">Acompanhe o consumo e libere as mesas ativas</p>
                                </div>
                                <div className="flex gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                                        <span className="text-xs font-black text-gray-600 uppercase tracking-widest">Livre</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-orange-500 rounded-full shadow-[0_0_5px_rgba(249,115,22,0.5)] animate-pulse"></div>
                                        <span className="text-xs font-black text-gray-600 uppercase tracking-widest">Ocupada</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {Array.from({ length: 20 }, (_, i) => i + 1).map(tableNum => {
                                    const tableName = `Mesa ${tableNum}`;
                                    // Encontrar pedidos ativos para esta mesa
                                    const activeOrders = dailyOrders.filter(o => {
                                        const cName = o.customer_name?.toLowerCase() || '';
                                        const tName = tableName.toLowerCase();
                                        return (cName === tName || cName.startsWith(`${tName} `) || cName.startsWith(`${tName}[`)) && 
                                               !['finished', 'archived'].includes(o.status);
                                    });
                                    
                                    const isOccupied = activeOrders.length > 0 || tableLocks[tableNum];
                                    const tableTotal = activeOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

                                    return (
                                        <div 
                                            key={tableNum} 
                                            className={`relative p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between min-h-[140px] ${
                                                isOccupied 
                                                    ? 'bg-white border-orange-400 shadow-md hover:shadow-lg hover:-translate-y-1' 
                                                    : 'bg-white border-gray-100 hover:border-green-300 hover:shadow-sm'
                                            }`}
                                            onClick={() => {
                                            if (isOccupied) {
                                                setSelectedTableDetails({ tableNum, activeOrders, tableTotal, isOnlyLocked: activeOrders.length === 0 });
                                                }
                                            }}
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className={`text-3xl font-black tracking-tighter ${isOccupied ? 'text-orange-600' : 'text-gray-300'}`}>
                                                    {tableNum}
                                                </span>
                                                <div className={`w-3 h-3 rounded-full ${isOccupied ? 'bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'}`}></div>
                                            </div>
                                            
                                            <div className="mt-4">
                                                {activeOrders.length > 0 ? (
                                                    <>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Consumo</p>
                                                        <p className="text-xl font-black text-gray-900 leading-none mt-1">
                                                            {tableTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </p>
                                                        <p className="text-[10px] text-orange-500 font-bold mt-2 bg-orange-50 w-fit px-2 py-0.5 rounded">
                                                            {activeOrders.length} pedido(s)
                                                        </p>
                                                    </>
                                                ) : isOccupied ? (
                                                    <>
                                                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Lendo Cardápio</p>
                                                        <p className="text-[10px] text-orange-500 font-bold mt-2 bg-orange-50 w-fit px-2 py-0.5 rounded">
                                                            Aguardando pedido...
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Mesa Disponível</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )
                }

                {/* MODAL DETALHES DA MESA */}
                {selectedTableDetails && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-lg max-h-[90vh] flex flex-col border border-gray-100">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Mesa {activeModalTableNum}</h2>
                                    <p className="text-sm font-bold text-gray-400 mt-1">Detalhes do Consumo</p>
                                </div>
                                <button 
                                    onClick={() => setSelectedTableDetails(null)} 
                                    className="w-10 h-10 bg-gray-100 hover:bg-red-100 hover:text-red-500 text-gray-500 rounded-full flex items-center justify-center font-black transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                {activeModalIsOnlyLocked ? (
                                    <div className="text-center py-10">
                                        <div className="text-6xl mb-4">📱</div>
                                        <h3 className="text-xl font-black text-gray-800 uppercase">Lendo Cardápio</h3>
                                        <p className="text-gray-500 font-medium mt-2">O cliente acessou o QR Code desta mesa, mas ainda não enviou nenhum pedido.</p>
                                    </div>
                                ) : (
                                    activeModalOrders.map(order => (
                                        <div key={order.id} className="bg-gray-50 border border-gray-200 p-4 rounded-2xl relative overflow-hidden">
                                        <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-black uppercase rounded-bl-xl ${
                                            order.status === 'pending' ? 'bg-gray-200 text-gray-600' :
                                            order.status === 'preparing' ? 'bg-yellow-200 text-yellow-700' :
                                            'bg-green-500 text-white shadow-sm'
                                        }`}>
                                            {order.status === 'pending' ? 'Pendente' : order.status === 'preparing' ? 'Preparando' : 'Pronto'}
                                        </div>

                                        <div className="mb-3">
                                            <span className="font-black text-gray-800 text-lg">Pedido #{order.order_number}</span>
                                            <span className="text-xs text-gray-400 font-bold ml-2">
                                                {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        
                                        <ul className="text-sm text-gray-600 space-y-1.5 mb-4">
                                            {order.items.map((item, idx) => (
                                                <li key={idx} className="flex justify-between font-medium">
                                                    <span><span className="font-black">{item.qty}x</span> {item.name}</span>
                                                    <span className="text-gray-400 font-bold">
                                                        {(Number(item.price) * item.qty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        
                                        <div className="flex justify-between items-end border-t border-gray-200 pt-3">
                                            <button 
                                                onClick={() => handleReprint(order)}
                                                className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors uppercase tracking-widest"
                                            >
                                                🖨️ Imprimir
                                            </button>
                                            <div className="text-right">
                                                <span className="text-[10px] font-black uppercase text-gray-400 block mb-0.5 tracking-widest">Subtotal</span>
                                                <span className="font-black text-gray-900 text-xl leading-none">
                                                    {Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                            </div>
                                        </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <div className="mt-6 pt-6 border-t-2 border-gray-100">
                                {!activeModalIsOnlyLocked && (
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Total a Pagar</span>
                                        <span className="text-4xl font-black text-orange-600 tracking-tighter">
                                            {activeModalTableTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                )}
                                
                                <button 
                                    onClick={async () => {
                                        const actionText = activeModalIsOnlyLocked ? 'Liberar a' : 'Encerrar a';
                                        if(confirm(`${actionText} Mesa ${activeModalTableNum}?`)) {
                                            try {
                                                if (!activeModalIsOnlyLocked) {
                                                    for (const order of activeModalOrders) {
                                                        await orderService.updateStatus(order.id, 'finished');
                                                    }
                                                }
                                                
                                                // Tenta forçar a liberação da trava no banco (Protegido pois o caixa pode não ter permissão na tabela)
                                                try {
                                                    await configService.updateSetting(`lock_mesa_${activeModalTableNum}`, JSON.stringify({ sid: 'force_clear', ts: 0 }));
                                                } catch (lockError) {
                                                    console.warn("Aviso: Sem permissão para limpar trava no banco. A interface atualizará localmente.");
                                                }
                                                
                                                // Limpa a trava localmente na mesma hora para a mesa ficar verde imediatamente
                                                setTableLocks(prev => {
                                                    const newLocks = { ...prev };
                                                    delete newLocks[activeModalTableNum];
                                                    return newLocks;
                                                });
                                                
                                                setSelectedTableDetails(null);
                                                loadDailyHistory();
                                                alert(`Mesa ${activeModalTableNum} liberada com sucesso!`);
                                            } catch (err) {
                                                console.error("Erro ao encerrar mesa:", err);
                                                alert("Ocorreu um erro ao processar. Tente novamente.");
                                            }
                                        }
                                    }}
                                    className="w-full bg-orange-600 text-white font-black py-5 rounded-2xl hover:bg-orange-700 active:scale-95 transition-all uppercase text-lg shadow-xl shadow-orange-600/20 flex justify-center items-center gap-2"
                                >
                                    <span>{activeModalIsOnlyLocked ? '🔓' : '💳'}</span> 
                                    {activeModalIsOnlyLocked ? 'Forçar Liberação da Mesa' : 'Encerrar e Pagar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

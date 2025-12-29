import { useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { useCart } from "../context/CartContext"
import { orderService } from "../services/api"

export default function Finish() {
  const navigate = useNavigate()
  const location = useLocation()
  const { lastOrder, clearCart } = useCart()

  const order = location.state?.order || lastOrder
  const [tempName, setTempName] = useState(order?.customerName || "Cliente")
  const hasProcessed = useRef(false)
  const [usbPrinter, setUsbPrinter] = useState(null)
  const [bluetoothDevice, setBluetoothDevice] = useState(null)
  const [bluetoothStatus, setBluetoothStatus] = useState("disconnected")
  const [isPrinting, setIsPrinting] = useState(false)

  const connectUSB = async () => {
    try {
      const device = await navigator.usb.requestDevice({ filters: [] })
      await device.open()
      await device.selectConfiguration(1)
      await device.claimInterface(device.configuration.interfaces[0].interfaceNumber)
      setUsbPrinter(device)
      alert("✅ Impressora conectada!")
    } catch (err) {
      console.error("Erro USB:", err)
      alert("❌ Erro ao conectar impressora.")
    }
  }

  const connectBluetooth = async (isAuto = false) => {
    const auto = isAuto === true;
    if (!navigator.bluetooth) {
      if (!auto) alert("❌ Bluetooth não suportado.");
      return null;
    }

    try {
      setBluetoothStatus("connecting");
      const services = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '00004953-0000-1000-8000-00805f9b34fb',
        '0000e7e1-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000ae30-0000-1000-8000-00805f9b34fb'
      ];

      let device;
      if (navigator.bluetooth.getDevices) {
        const devices = await navigator.bluetooth.getDevices();
        device = devices.find(d => ['POS', 'MP', 'MTP', 'Inner', 'Goojprt', 'BT', 'PRINTER', 'MINI'].some(p => d.name?.toUpperCase().includes(p))) || devices[0];
      }

      if (!device && !auto) {
        device = await navigator.bluetooth.requestDevice({
          filters: [
            { namePrefix: 'POS' }, { namePrefix: 'MP' }, { namePrefix: 'MTP' },
            { namePrefix: 'Inner' }, { namePrefix: 'Goojprt' }, { namePrefix: 'BT' },
            { namePrefix: 'mini' }, { namePrefix: 'PRINTER' }
          ],
          optionalServices: services
        });
      }

      if (!device) {
        setBluetoothStatus("disconnected");
        return null;
      }

      const server = await device.gatt.connect();
      let service;
      for (const uuid of services) {
        try {
          service = await server.getPrimaryService(uuid);
          if (service) break;
        } catch (e) { continue; }
      }

      if (!service) {
        const all = await server.getPrimaryServices();
        if (all.length > 0) service = all[0];
      }

      const characteristics = await service.getCharacteristics();
      const char = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);

      setBluetoothDevice(char);
      setBluetoothStatus("connected");

      device.addEventListener('gattserverdisconnected', () => {
        setBluetoothStatus("disconnected");
        setBluetoothDevice(null);
      });

      return char;
    } catch (err) {
      console.error(err);
      setBluetoothStatus("disconnected");
      return null;
    }
  }

  const printBluetooth = async (isManual = false) => {
    let char = bluetoothDevice;
    if (!char) char = await connectBluetooth(!isManual);
    if (!char || !order) return false;

    try {
      const encoder = new TextEncoder();
      const clean = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\x7F]/g, "");
      const txt = (s) => encoder.encode(clean(s) + '\n');

      const INIT = [0x1B, 0x40], CENTER = [0x1B, 0x61, 0x01], LEFT = [0x1B, 0x61, 0x00];
      const BOLD_ON = [0x1B, 0x45, 0x01], BOLD_OFF = [0x1B, 0x45, 0x00];
      const DBL_ON = [0x1B, 0x21, 0x30], DBL_OFF = [0x1B, 0x21, 0x01], FEED = [0x1D, 0x56, 0x41, 0x03];

      let data = new Uint8Array([
        ...INIT, ...CENTER, ...BOLD_ON, ...DBL_ON, ...txt("HERO'S BURGER"), ...DBL_OFF,
        ...txt("CNPJ: 00.000.000/0001-00"), ...txt("Tel: (63) 99103-8781"),
        ...txt("Autoatendimento"), ...BOLD_OFF, ...txt("--------------------------------"),
        ...BOLD_ON, ...txt(`PEDIDO: ${order.orderNumber}`), ...BOLD_OFF,
        ...LEFT, ...txt(`Cliente: ${tempName}`), ...txt(`Data: ${new Date().toLocaleString('pt-BR')}`),
        ...txt("--------------------------------"),
      ]);

      order.items.forEach(item => {
        const line = `${item.qty}x ${item.name.slice(0, 18)}`.padEnd(22) + ` R$${(item.price * item.qty).toFixed(2)}`;
        data = new Uint8Array([...data, ...txt(line)]);
        if (item.observation) data = new Uint8Array([...data, ...txt(`  > ${item.observation}`)]);
      });

      data = new Uint8Array([
        ...data, ...txt("--------------------------------"),
        ...BOLD_ON, ...txt(`TOTAL: R$ ${Number(order.total).toFixed(2)}`), ...BOLD_OFF,
        ...CENTER, ...txt("\nAcompanhe sua senha no painel!"), ...FEED
      ]);

      const writeType = char.writeValueWithoutResponse ? 'writeValueWithoutResponse' :
        char.writeValueWithResponse ? 'writeValueWithResponse' :
          'writeValue';

      const chunkSize = 20;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        try {
          await char[writeType](chunk);
        } catch (writeErr) {
          console.error("Write error:", writeErr);
          if (char.writeValue) await char.writeValue(chunk);
        }
        await new Promise(r => setTimeout(r, 20));
      }
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  const printUSB = async () => {
    if (!usbPrinter || !order) return false
    try {
      const encoder = new TextEncoder()
      const txt = (str) => encoder.encode(str + '\n')

      const INIT = new Uint8Array([0x1B, 0x40])
      const CENTER = new Uint8Array([0x1B, 0x61, 0x01])
      const LEFT = new Uint8Array([0x1B, 0x61, 0x00])
      const BOLD_ON = new Uint8Array([0x1B, 0x45, 0x01])
      const BOLD_OFF = new Uint8Array([0x1B, 0x45, 0x00])
      const DOUBLE_ON = new Uint8Array([0x1B, 0x21, 0x30])
      const DOUBLE_OFF = new Uint8Array([0x1B, 0x21, 0x01])
      const FEED = new Uint8Array([0x1D, 0x56, 0x41, 0x03])

      let data = new Uint8Array([
        ...INIT, ...CENTER, ...BOLD_ON, ...DOUBLE_ON, ...txt("HERO'S BURGER"), ...DOUBLE_OFF,
        ...txt("CNPJ: 00.000.000/0001-00"),
        ...txt("Tel: (63) 99103-8781"),
        ...txt("Autoatendimento"), ...BOLD_OFF,
        ...txt("--------------------------------"),
        ...BOLD_ON, ...txt(`PEDIDO: ${order.orderNumber}`), ...BOLD_OFF,
        ...LEFT, ...txt(`Cliente: ${tempName}`),
        ...txt(`Data: ${new Date().toLocaleString()}`),
        ...txt("--------------------------------"),
      ])

      order.items.forEach(item => {
        const line = `${item.qty}x ${item.name.slice(0, 18)}`.padEnd(20) + ` R$${(item.price * item.qty).toFixed(2)}`
        data = new Uint8Array([...data, ...txt(line)])
        if (item.observation) data = new Uint8Array([...data, ...txt(`  > ${item.observation}`)])
      })

      data = new Uint8Array([
        ...data,
        ...txt("--------------------------------"),
        ...BOLD_ON, ...txt(`TOTAL: R$ ${Number(order.total).toFixed(2)}`), ...BOLD_OFF,
        ...CENTER, ...txt("\nAcompanhe sua senha no painel!"), ...FEED
      ])

      const endpoint = usbPrinter.configuration.interfaces[0].alternates[0].endpoints.find(e => e.direction === 'out').endpointNumber
      await usbPrinter.transferOut(endpoint, data)
      return true
    } catch (err) {
      console.error("Erro na impressão USB:", err)
      return false
    }
  }

  useEffect(() => {
    const processOrder = async () => {
      if (order && !hasProcessed.current) {
        hasProcessed.current = true
        try {
          const saved = await orderService.createOrder(order)
          if (saved && saved.id) order.id = saved.id
          window.dispatchEvent(new CustomEvent('new-order-placed', { detail: order }))
          clearCart()
        } catch (err) {
          console.error("Erro ao salvar pedido:", err)
        }
      }
    }
    processOrder()
    if (order?.customerName) setTempName(order.customerName)

    // Tenta reconectar bluetooth se disponível
    if (bluetoothStatus === 'disconnected') connectBluetooth(true);

    // Tenta reconectar USB silenciosamente (se já autorizado antes)
    const autoConnectUSB = async () => {
      if (navigator.usb && navigator.usb.getDevices) {
        const devices = await navigator.usb.getDevices();
        if (devices.length > 0) {
          try {
            const device = devices[0];
            await device.open();
            await device.selectConfiguration(1);
            await device.claimInterface(device.configuration.interfaces[0].interfaceNumber);
            setUsbPrinter(device);
          } catch (e) { console.log("USB Auto-connect failed:", e); }
        }
      }
    };
    autoConnectUSB();

    const handleAfterPrint = () => handleNewOrder()
    window.addEventListener('afterprint', handleAfterPrint)

    const safetyTimer = setTimeout(() => handleNewOrder(), 30000)

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      clearTimeout(safetyTimer)
    }
  }, [order, clearCart, bluetoothStatus])

  const handleUpdateName = async () => {
    if (order?.id) await orderService.updateOrderName(order.id, tempName)
    order.customerName = tempName
  }

  function handleNewOrder() {
    window.location.href = "/"
  }

  const [configClickCount, setConfigClickCount] = useState(0)
  const [showAdminConfig, setShowAdminConfig] = useState(false)

  const handleAdminUnlock = () => {
    const newCount = configClickCount + 1
    if (newCount >= 7) {
      setShowAdminConfig(true)
      setConfigClickCount(0)
    } else {
      setConfigClickCount(newCount)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setConfigClickCount(0), 3000)
    return () => clearTimeout(timer)
  }, [configClickCount])

  if (!order || !order.orderNumber) {
    return (
      <div className="h-screen w-screen bg-red-600 flex flex-col items-center justify-center text-white p-10 text-center">
        <h1 className="text-4xl font-bold mb-4">⚠️ Erro ao carregar pedido</h1>
        <button onClick={handleNewOrder} className="bg-white text-red-600 px-8 py-4 rounded-xl font-bold text-xl">
          Voltar ao Início
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-screen bg-green-600 flex flex-col items-center pt-10 pb-20 text-white overflow-y-auto">
      <h1 onClick={handleAdminUnlock} className="text-5xl font-extrabold mb-6 text-center animate-bounce cursor-default select-none">
        ✅ SUCESSO!
      </h1>

      <div className="mb-2 text-center w-full max-w-2xl px-6">
        <input
          type="text"
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onBlur={handleUpdateName}
          className="w-full bg-transparent text-7xl font-black text-white uppercase text-center focus:outline-none placeholder-white/30 truncate"
          placeholder="Seu Nome"
        />
      </div>

      <div className="text-[180px] leading-none font-black mb-10 drop-shadow-2xl text-yellow-300">
        {order.orderNumber}
      </div>

      {order.orderObservation && (
        <div className="mb-10 bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/20">
          <p className="text-2xl italic text-white font-medium italic">"{order.orderObservation}"</p>
        </div>
      )}

      <div className="mb-12">
        <p className="text-5xl font-black text-white/90">
          {Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm px-6">
        <button
          onClick={async () => {
            if (isPrinting) return
            setIsPrinting(true)

            // PRIORIDADE 1: USB (Totem)
            if (usbPrinter) {
              const usbSuccess = await printUSB()
              if (usbSuccess) {
                setIsPrinting(false)
                return handleNewOrder()
              }
            }

            // PRIORIDADE 2: BLUETOOTH (Mobile/Cashier)
            const btSuccess = await printBluetooth(true)
            if (btSuccess) {
              setIsPrinting(false)
              return handleNewOrder()
            }

            // FINAL: Se nada funcionar, avisa e pergunta se quer Wi-Fi
            setIsPrinting(false)
            if (!usbPrinter && bluetoothStatus !== 'connected') {
              // Se não tem nenhum configurado, abre BT por padrão (mais comum em mobile)
              // ou o usuário pode usar o link de Wi-Fi abaixo
              alert("Nenhuma impressora configurada. Conecte no menu (clicando 7x no SUCESSO) ou use a impressora do sistema abaixo.")
            }
          }}
          disabled={isPrinting}
          className={`w-full py-4 bg-white text-gray-800 text-xl font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 screen-only transition-all ${isPrinting ? 'opacity-50' : 'hover:bg-gray-50 active:scale-95'}`}
        >
          <span>{isPrinting ? '⏳' : '🖨️'}</span>
          {isPrinting ? 'IMPRIMINDO...' : usbPrinter ? 'IMPRIMIR RECIBO (USB)' : bluetoothStatus === 'connected' ? 'IMPRIMIR RECIBO (BT)' : 'CONECTAR E IMPRIMIR'}
        </button>

        <button
          onClick={() => window.print()}
          className="text-white/60 text-xs font-bold uppercase hover:text-white py-1 screen-only"
        >
          Ou usar impressora Wi-Fi/Sistema
        </button>

        {showAdminConfig && (
          <div className="flex flex-col gap-2">
            <button
              onClick={connectUSB}
              className={`w-full py-2 text-white text-[10px] font-black rounded-xl border border-white/20 transition-all screen-only ${usbPrinter ? 'bg-blue-600/50 hover:bg-blue-600' : 'bg-green-700/50 hover:bg-green-700'}`}
            >
              {usbPrinter ? '✅ RECONFIGURAR USB' : '🔗 CONECTAR USB'}
            </button>
            <button
              onClick={() => connectBluetooth()}
              className={`w-full py-2 text-white text-[10px] font-black rounded-xl border border-white/20 transition-all screen-only ${bluetoothStatus === 'connected' ? 'bg-blue-600/50 hover:bg-blue-600' : 'bg-orange-600/50 hover:bg-orange-600'}`}
            >
              {bluetoothStatus === 'connected' ? '✅ RECONFIGURAR BLUETOOTH' : '🔗 CONECTAR BLUETOOTH'}
            </button>
          </div>
        )}

        <button onClick={handleNewOrder} className="w-full py-6 bg-white text-green-600 text-3xl font-black rounded-2xl shadow-2xl hover:scale-[1.02] transition-transform active:scale-95 screen-only">
          NOVO PEDIDO
        </button>
      </div>

      <div id="receipt" className="hidden p-4 max-w-[80mm] mx-auto text-black bg-white font-mono text-xs leading-tight">
        <div className="text-center mb-4">
          <h2 className="text-xl font-black uppercase">Hero's Burger</h2>
          <p className="text-xs italic">CNPJ: 00.000.000/0001-00</p>
          <p className="text-xs">TEL: (63) 99103-8781</p>
        </div>
        <div className="border-b border-black border-dashed my-2"></div>
        <div className="flex justify-between font-bold text-lg my-2">
          <span>PEDIDO:</span>
          <span className="text-2xl">{order.orderNumber}</span>
        </div>
        <div className="font-bold uppercase truncate">CLIENTE: {tempName}</div>
        <div className="text-[10px] mb-2">Data: {new Date().toLocaleString('pt-BR')}</div>
        <div className="border-b border-black border-dashed my-2"></div>
        <table className="w-full text-left font-mono text-[10px]">
          <tbody>
            {order.items?.map((item, i) => (
              <tr key={i} className="border-b border-black border-dashed">
                <td className="py-1 w-6">{item.qty}x</td>
                <td className="py-1">
                  <div>{item.name}</div>
                  {item.observation && <div className="text-[9px] italic">➔ {item.observation}</div>}
                </td>
                <td className="py-1 text-right">{(item.price * item.qty).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-black border-dashed pt-2 my-2 font-bold flex justify-between text-base">
          <span>TOTAL</span>
          <span>{Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        {order.observation && (
          <div className="mt-2 text-[9px] border border-black p-1">
            <strong>OBS:</strong> {order.observation}
          </div>
        )}
        <div className="text-center mt-4 text-[9px]">Obrigado pela preferencia!</div>
      </div>
    </div>
  )
}

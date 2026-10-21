import React, { useState, useEffect } from 'react';
import {
  Scale,
  CupSoda,
  Plus,
  Trash2,
  ClipboardList,
  Settings,
  RefreshCw,
  Edit3,
  CheckCircle2,
  Printer,
  IceCream,
  Camera,
  Lock,
  Calendar
} from 'lucide-react';
import {
  acaiService,
  DEFAULT_ACAI_SETTINGS,
  DEFAULT_ACAI_ADDONS,
  DEFAULT_ACAI_FLAVORS,
  DEFAULT_ACAI_CUPS
} from '../services/acaiApi';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

export default function CashierAcaiTab({ user, onPrintOrder }) {
  const [subTab, setSubTab] = useState('pos'); // 'pos' | 'orders' | 'config'
  const [settings, setSettings] = useState(DEFAULT_ACAI_SETTINGS);
  const [addons, setAddons] = useState(DEFAULT_ACAI_ADDONS);
  const [flavors, setFlavors] = useState(DEFAULT_ACAI_FLAVORS);
  const [cups, setCups] = useState(DEFAULT_ACAI_CUPS);
  const [dbWarning, setDbWarning] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);

  // Segurança Admin para aba Configurar & Fotos e para Excluir Pedido
  const [isConfigUnlocked, setIsConfigUnlocked] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [orderToDelete, setOrderToDelete] = useState(null);

  // Filtro de Data para a aba de Pedidos / Caixa do Dia
  const [reportDate, setReportDate] = useState(() => new Date().toLocaleDateString('en-CA'));

  // Estado da Balança no PDV ('acai' | 'sorvete') + peso total em gramas
  const [scaleType, setScaleType] = useState('acai');
  const [scaleGrams, setScaleGrams] = useState('');
  const [cupFilter, setCupFilter] = useState('todos'); // 'todos' | 'acai' | 'sorvete'
  const [selectedPosFlavors, setSelectedPosFlavors] = useState([]);

  // Carrinho exclusivo de Açaí & Sorvete no Caixa
  const [acaiCart, setAcaiCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(''); // 'dinheiro' | 'pix' | 'cartao'
  const [changeAmount, setChangeAmount] = useState('');
  const [savingSale, setSavingSale] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  // Lista de Pedidos (Online + Balcão) em acai_orders
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Forms de Configuração
  const [settingsForm, setSettingsForm] = useState({
    price_per_kg: 60,
    ice_cream_price_per_kg: 50,
    acai_image: '',
    ice_cream_image: '',
    min_grams: 300,
    step_grams: 50,
    weight_options_text: '300, 400, 500, 750, 1000',
    whatsapp_number: '',
    is_open: true
  });
  const [cupForm, setCupForm] = useState({
    id: null,
    name: '',
    category: 'acai',
    size_ml: 300,
    description: '',
    price: '',
    image: '',
    out_of_stock: false
  });
  const [flavorForm, setFlavorForm] = useState({
    id: null,
    name: '',
    image: '',
    out_of_stock: false
  });
  const [addonForm, setAddonForm] = useState({
    id: null,
    name: '',
    type: 'incluso',
    price: '',
    image: '',
    out_of_stock: false
  });

  const loadAllAcaiData = async () => {
    try {
      const [loadedSettings, loadedAddons, loadedFlavors, loadedCups] = await Promise.all([
        acaiService.getSettings(),
        acaiService.getAddons(),
        acaiService.getFlavors(),
        acaiService.getCups()
      ]);

      setSettings(loadedSettings);
      setDbWarning(Boolean(loadedSettings._fromFallback));
      setAddons(loadedAddons);
      setFlavors(loadedFlavors);
      setCups(loadedCups);

      setSettingsForm({
        price_per_kg: loadedSettings.price_per_kg,
        ice_cream_price_per_kg:
          loadedSettings.ice_cream_price_per_kg ?? loadedSettings.price_per_kg ?? 50,
        acai_image: loadedSettings.acai_image || '',
        ice_cream_image: loadedSettings.ice_cream_image || '',
        min_grams: loadedSettings.min_grams,
        step_grams: loadedSettings.step_grams || 50,
        weight_options_text: (loadedSettings.weight_options || [300, 400, 500, 1000]).join(', '),
        whatsapp_number: loadedSettings.whatsapp_number || '',
        is_open: loadedSettings.is_open ?? true
      });
    } catch (err) {
      console.error('Erro ao carregar dados de Açaí e Sorvete no Caixa:', err);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await acaiService.getOrders(100);
      setOrders(data);
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadAllAcaiData();
    loadOrders();

    const sub = acaiService.subscribeToOrders(() => {
      loadOrders();
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  // Helper genérico para upload de foto
  const handleFileUpload = async (file, fieldKey, onSuccess) => {
    if (!file) return;
    setUploadingField(fieldKey);
    try {
      const url = await acaiService.uploadImage(file);
      if (url) onSuccess(url);
    } catch (err) {
      alert(`Erro ao enviar imagem: ${err.message}`);
    } finally {
      setUploadingField(null);
    }
  };

  const acaiPricePerKg = Number(settings.price_per_kg || 60);
  const iceCreamPricePerKg = Number(
    settings.ice_cream_price_per_kg ?? settings.price_per_kg ?? 50
  );
  const activePricePerKg = scaleType === 'sorvete' ? iceCreamPricePerKg : acaiPricePerKg;
  const gramsNumber = Math.max(0, Number(scaleGrams) || 0);

  const calculateScaleTotal = () => {
    const weightPrice = (activePricePerKg / 1000) * gramsNumber;
    return Number(weightPrice.toFixed(2));
  };

  const handleTogglePosFlavor = (flavor) => {
    if (flavor.out_of_stock) return;
    if (selectedPosFlavors.some((f) => f.id === flavor.id)) {
      setSelectedPosFlavors(selectedPosFlavors.filter((f) => f.id !== flavor.id));
    } else {
      setSelectedPosFlavors([...selectedPosFlavors, flavor]);
    }
  };

  const handleAddScaleItemToCart = (e) => {
    if (e) e.preventDefault();
    if (!gramsNumber || gramsNumber <= 0) {
      alert('Digite a quantidade de gramas pesada na balança!');
      return;
    }

    const itemTotal = calculateScaleTotal();
    const labelTipo = scaleType === 'sorvete' ? 'Sorvete no Quilo' : 'Açaí no Quilo';
    const flavorNames = scaleType === 'sorvete' ? selectedPosFlavors.map((f) => f.name) : [];
    const itemTitle =
      flavorNames.length > 0
        ? `${labelTipo} - Balança (${gramsNumber}g) [${flavorNames.join(', ')}]`
        : `${labelTipo} - Balança (${gramsNumber}g)`;
    const newItem = {
      id: `balanca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'balanca',
      product_type: scaleType,
      qty: 1,
      name: itemTitle,
      title: itemTitle,
      price: itemTotal,
      grams: gramsNumber,
      price_per_kg: activePricePerKg,
      flavors: flavorNames,
      addons: [],
      notes: '',
      observation: '',
      total: itemTotal
    };

    setAcaiCart((prev) => [...prev, newItem]);
    setScaleGrams('');
    setSelectedPosFlavors([]);
  };

  const handleAddReadyCupToCart = (cup) => {
    if (cup.out_of_stock) {
      alert('Este item está marcado como esgotado.');
      return;
    }

    const isSorvete = (cup.category || 'acai') === 'sorvete';
    const flavorNames = isSorvete ? selectedPosFlavors.map((f) => f.name) : [];
    const baseTitle = cup.size_ml ? `${cup.name} (${cup.size_ml}ml)` : cup.name;
    const itemTitle = flavorNames.length > 0 ? `${baseTitle} [${flavorNames.join(', ')}]` : baseTitle;
    const itemPrice = Number(cup.price || 0);

    const newItem = {
      id: `copo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'copo_pronto',
      product_type: cup.category || 'acai',
      cup_id: cup.id,
      qty: 1,
      name: itemTitle,
      title: itemTitle,
      price: itemPrice,
      size_ml: Number(cup.size_ml || 0),
      description: cup.description || '',
      grams: 0,
      flavors: flavorNames,
      addons: [],
      notes: '',
      observation: '',
      total: itemPrice
    };

    setAcaiCart((prev) => [...prev, newItem]);
    if (isSorvete) setSelectedPosFlavors([]);
  };

  const handleRemoveCartItem = (id) => {
    setAcaiCart((prev) => prev.filter((item) => item.id !== id));
  };

  const cartTotal = Number(
    acaiCart.reduce((acc, item) => acc + Number(item.total || 0), 0).toFixed(2)
  );

  const formatOrderForSystemPrint = (ord) => {
    const isOnline = !ord.cashier_name && !ord.cashierName;
    const rawPgto = ord.payment_method || ord.paymentMethod || '';
    const formattedItems = (ord.items || []).map((it) => {
      const rawObs = it.notes !== undefined ? it.notes : it.observation || '';
      const alreadyFormatted =
        it.notes === undefined &&
        (rawObs.includes('Sabores:') || rawObs.includes('Acomp:'));

      let finalObs = rawObs;
      if (!alreadyFormatted) {
        const extraDetails = [];
        if (Array.isArray(it.flavors) && it.flavors.length > 0) {
          extraDetails.push(`Sabores: ${it.flavors.join(', ')}`);
        }
        if (Array.isArray(it.addons) && it.addons.length > 0) {
          extraDetails.push(`Acomp: ${it.addons.map((a) => a.name || a).join(', ')}`);
        }
        if (rawObs) {
          extraDetails.push(rawObs);
        }
        finalObs = extraDetails.join(' | ');
      }

      return {
        qty: it.qty || 1,
        name: it.name || it.title || `Acai ${it.grams || 0}g`,
        price: Number(it.price ?? it.total ?? 0),
        observation: finalObs
      };
    });

    const addrRaw = ord.customer_address || ord.customerAddress || '';
    return {
      id: ord.id,
      created_at: ord.created_at || new Date().toISOString(),
      orderNumber: ord.order_number || ord.orderNumber,
      cashierName: ord.cashier_name || ord.cashierName || (isOnline ? null : user?.name || 'Caixa'),
      customerName: ord.customer_name || ord.customerName || 'Balcão',
      customerAddress: addrRaw === 'Venda de Balcão (Caixa)' ? '' : addrRaw,
      paymentMethod:
        isOnline && rawPgto && !rawPgto.startsWith('online_') ? `online_${rawPgto}` : rawPgto,
      changeAmount: ord.change_amount ?? ord.changeAmount ?? null,
      observation: ord.observation || '',
      items: formattedItems,
      total: Number(ord.total || 0)
    };
  };

  const handleFinishCashierAcaiSale = async () => {
    if (acaiCart.length === 0) {
      alert('Adicione o peso da balança ou um item pronto antes de finalizar!');
      return;
    }
    if (!paymentMethod) {
      alert('Selecione a forma de pagamento (Dinheiro, PIX ou Cartão)!');
      return;
    }
    if (paymentMethod === 'dinheiro' && changeAmount && Number(changeAmount) < cartTotal) {
      alert('O valor recebido para troco não pode ser menor que o total!');
      return;
    }

    const orderNumber = String(Math.floor(1000 + Math.random() * 9000));
    const totalGrams = acaiCart.reduce((acc, item) => acc + Number(item.grams || 0), 0);

    const payload = {
      orderNumber,
      customerName: customerName.trim() || 'Balcão',
      customerPhone: null,
      deliveryType: 'balcao',
      customerAddress: 'Venda de Balcão (Caixa)',
      cashierName: user?.name || 'Caixa',
      paymentMethod,
      changeAmount: paymentMethod === 'dinheiro' && changeAmount ? Number(changeAmount) : null,
      observation: '',
      grams: totalGrams,
      pricePerKg: activePricePerKg,
      addons: [],
      items: acaiCart,
      total: cartTotal,
      status: 'finished'
    };

    setSavingSale(true);
    try {
      const { data, error } = await acaiService.createOrder(payload);
      if (error) {
        alert(
          `❌ Erro ao salvar venda em acai_orders: ${error.message}\n\nCertifique-se de ter executado a migration SQL no Supabase.`
        );
        return;
      }

      const finalOrderData = {
        ...payload,
        id: data?.id,
        created_at: data?.created_at || new Date().toISOString()
      };

      if (onPrintOrder) {
        onPrintOrder(formatOrderForSystemPrint(finalOrderData), true);
      } else {
        setLastReceipt(finalOrderData);
      }
      setAcaiCart([]);
      setCustomerName('');
      setPaymentMethod('');
      setChangeAmount('');
      loadOrders();
    } catch (err) {
      console.error('Erro ao registrar venda no caixa:', err);
      alert('Erro inesperado ao salvar venda.');
    } finally {
      setSavingSale(false);
    }
  };

  // Handlers de Configuração
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const weightOptions = settingsForm.weight_options_text
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      await acaiService.updateSettings({
        price_per_kg: Number(settingsForm.price_per_kg),
        ice_cream_price_per_kg: Number(settingsForm.ice_cream_price_per_kg),
        acai_image: settingsForm.acai_image,
        ice_cream_image: settingsForm.ice_cream_image,
        min_grams: Number(settingsForm.min_grams),
        step_grams: Number(settingsForm.step_grams || 50),
        weight_options: weightOptions.length > 0 ? weightOptions : [300, 400, 500, 1000],
        whatsapp_number: settingsForm.whatsapp_number,
        is_open: settingsForm.is_open
      });
      await loadAllAcaiData();
      alert('✅ Configurações e fotos salvas com sucesso!');
    } catch (err) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    }
  };

  const handleSaveCup = async (e) => {
    e.preventDefault();
    if (!cupForm.name.trim()) return;
    try {
      await acaiService.saveCup({
        id: cupForm.id,
        name: cupForm.name,
        category: cupForm.category,
        size_ml: Number(cupForm.size_ml || 300),
        description: cupForm.description,
        price: Number(cupForm.price || 0),
        image: cupForm.image,
        out_of_stock: cupForm.out_of_stock
      });
      setCupForm({
        id: null,
        name: '',
        category: 'acai',
        size_ml: 300,
        description: '',
        price: '',
        image: '',
        out_of_stock: false
      });
      await loadAllAcaiData();
    } catch (err) {
      alert(`Erro ao salvar item pronto: ${err.message}`);
    }
  };

  const handleToggleCupStock = async (cup) => {
    try {
      await acaiService.saveCup({
        ...cup,
        out_of_stock: !cup.out_of_stock
      });
      await loadAllAcaiData();
    } catch (err) {
      alert(`Erro ao alterar estoque: ${err.message}`);
    }
  };

  const handleDeleteCup = async (id) => {
    if (!window.confirm('Remover este item pronto?')) return;
    try {
      await acaiService.deleteCup(id);
      await loadAllAcaiData();
    } catch (err) {
      alert(`Erro ao remover item: ${err.message}`);
    }
  };

  const handleSaveFlavor = async (e) => {
    e.preventDefault();
    if (!flavorForm.name.trim()) return;
    try {
      await acaiService.saveFlavor({
        id: flavorForm.id,
        name: flavorForm.name,
        category: 'sorvete',
        image: flavorForm.image,
        out_of_stock: flavorForm.out_of_stock
      });
      setFlavorForm({ id: null, name: '', image: '', out_of_stock: false });
      await loadAllAcaiData();
    } catch (err) {
      alert(`Erro ao salvar sabor de sorvete: ${err.message}`);
    }
  };

  const handleToggleFlavorStock = async (flavor) => {
    try {
      await acaiService.saveFlavor({
        ...flavor,
        out_of_stock: !flavor.out_of_stock
      });
      await loadAllAcaiData();
    } catch (err) {
      alert(`Erro ao alterar estoque do sabor: ${err.message}`);
    }
  };

  const handleDeleteFlavor = async (id) => {
    if (!window.confirm('Remover este sabor de sorvete?')) return;
    try {
      await acaiService.deleteFlavor(id);
      await loadAllAcaiData();
    } catch (err) {
      alert(`Erro ao remover sabor: ${err.message}`);
    }
  };

  const handleSaveAddon = async (e) => {
    e.preventDefault();
    if (!addonForm.name.trim()) return;
    try {
      await acaiService.saveAddon({
        id: addonForm.id,
        name: addonForm.name,
        type: addonForm.type,
        price: addonForm.type === 'pago' ? Number(addonForm.price || 0) : 0,
        image: addonForm.image,
        out_of_stock: addonForm.out_of_stock
      });
      setAddonForm({ id: null, name: '', type: 'incluso', price: '', image: '', out_of_stock: false });
      await loadAllAcaiData();
    } catch (err) {
      alert(`Erro ao salvar acompanhamento: ${err.message}`);
    }
  };

  const handleToggleAddonStock = async (addon) => {
    try {
      await acaiService.saveAddon({
        ...addon,
        out_of_stock: !addon.out_of_stock
      });
      await loadAllAcaiData();
    } catch (err) {
      alert(`Erro ao alterar estoque do acompanhamento: ${err.message}`);
    }
  };

  const handleDeleteAddon = async (id) => {
    if (!window.confirm('Remover este acompanhamento?')) return;
    try {
      await acaiService.deleteAddon(id);
      await loadAllAcaiData();
    } catch (err) {
      alert(`Erro ao remover acompanhamento: ${err.message}`);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await acaiService.updateOrderStatus(orderId, newStatus);
      await loadOrders();
    } catch (err) {
      alert(`Erro ao atualizar status: ${err.message}`);
    }
  };

  const handleRequestDeleteOrder = (ord) => {
    setOrderToDelete(ord);
    setAdminPassInput('');
    setShowAdminModal(true);
  };

  const pendingOnlineCount = orders.filter(
    (o) => !o.cashier_name && o.status === 'pending'
  ).length;

  const filteredCups = cups.filter((c) => {
    if (cupFilter === 'todos') return true;
    return (c.category || 'acai') === cupFilter;
  });

  // Handler para abrir Configurações exigindo a Senha do Admin
  const handleClickConfigTab = () => {
    if (isConfigUnlocked) {
      setSubTab('config');
    } else {
      setOrderToDelete(null);
      setAdminPassInput('');
      setShowAdminModal(true);
    }
  };

  const handleVerifyAdminPassword = async (e) => {
    e.preventDefault();
    if (adminPassInput !== ADMIN_PASSWORD) {
      alert('❌ Senha de Administrador incorreta!');
      setAdminPassInput('');
      return;
    }

    if (orderToDelete) {
      try {
        await acaiService.deleteOrder(orderToDelete.id);
        await loadOrders();
      } catch (err) {
        alert(`Erro ao excluir pedido: ${err.message}`);
      } finally {
        setOrderToDelete(null);
        setShowAdminModal(false);
        setAdminPassInput('');
      }
      return;
    }

    setIsConfigUnlocked(true);
    setShowAdminModal(false);
    setAdminPassInput('');
    setSubTab('config');
  };

  // Cálculos do Dia para a aba Pedidos (respeitando user.can_view_reports igual ao Caixa da Pizzaria)
  const canViewReports = Boolean(user?.can_view_reports);
  const todayStr = new Date().toLocaleDateString('en-CA');
  const effectiveDate = canViewReports ? reportDate : todayStr;

  const getOrderDateStr = (ord) =>
    ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-CA') : todayStr;

  const dailyOrders = orders.filter((o) => {
    if (getOrderDateStr(o) !== effectiveDate) return false;
    if (canViewReports) return true;
    // Sem permissão de relatórios: vê apenas suas próprias vendas de hoje e pedidos online de hoje para atender
    return !o.cashier_name || o.cashier_name === (user?.name || 'Caixa');
  });
  const validDailyOrders = orders
    .filter((o) => getOrderDateStr(o) === effectiveDate && o.status !== 'cancelled');

  const totalDiaGeral = validDailyOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const suasVendasHojeList = validDailyOrders.filter(
    (o) => o.cashier_name && o.cashier_name === (user?.name || 'Caixa')
  );
  const totalSuasVendas = suasVendasHojeList.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const totalCardapioOnline = validDailyOrders
    .filter((o) => !o.cashier_name)
    .reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const totalOutrosOperadores = validDailyOrders
    .filter((o) => o.cashier_name && o.cashier_name !== (user?.name || 'Caixa'))
    .reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  const totalPix = validDailyOrders
    .filter((o) => String(o.payment_method || '').toLowerCase().includes('pix'))
    .reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const totalDinheiro = validDailyOrders
    .filter((o) => String(o.payment_method || '').toLowerCase().includes('dinheiro'))
    .reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const totalCartao = validDailyOrders
    .filter((o) => String(o.payment_method || '').toLowerCase().includes('cart'))
    .reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  return (
    <div className="h-full flex flex-col bg-purple-50/40 overflow-hidden">
      {/* MODAL DE SENHA DO ADMIN (PARA ACESSAR CONFIGURAÇÕES OU EXCLUIR PEDIDO) */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleVerifyAdminPassword}
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border-t-8 border-purple-700 space-y-4"
          >
            <div className="text-center space-y-1">
              <div className="w-14 h-14 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <Lock size={28} />
              </div>
              <h3 className="text-xl font-black text-gray-900 uppercase">
                {orderToDelete ? 'Excluir Pedido' : 'Acesso Restrito'}
              </h3>
              <p className="text-xs text-gray-500">
                {orderToDelete ? (
                  <>
                    Digite a <strong>Senha do Admin</strong> para excluir permanentemente o pedido{' '}
                    <strong>#{orderToDelete.order_number}</strong> ({orderToDelete.customer_name}).
                  </>
                ) : (
                  <>
                    Digite a <strong>Senha do Admin</strong> para acessar as configurações e fotos de Açaí & Sorvetes.
                  </>
                )}
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">
                Senha do Administrador
              </label>
              <input
                type="password"
                autoFocus
                required
                value={adminPassInput}
                onChange={(e) => setAdminPassInput(e.target.value)}
                placeholder="••••••"
                className="w-full border-2 border-gray-200 bg-gray-50 p-3.5 rounded-xl text-gray-900 font-bold focus:border-purple-600 focus:bg-white focus:outline-none text-center text-lg"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdminModal(false);
                  setOrderToDelete(null);
                  setAdminPassInput('');
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`flex-1 text-white font-black py-3 rounded-xl text-xs shadow-lg cursor-pointer ${
                  orderToDelete
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-purple-700 hover:bg-purple-800'
                }`}
              >
                {orderToDelete ? '🗑️ Confirmar Exclusão' : '🔓 Desbloquear'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-HEADER DO MÓDULO AÇAÍ & SORVETE NO CAIXA */}
      <div className="bg-purple-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-purple-800 shadow-sm screen-only">
        <div className="flex items-center gap-2">
          <span className="text-lg">💜🍦</span>
          <div>
            <h2 className="font-black text-sm uppercase tracking-wider leading-none">
              PDV Açaí & Sorvetes — Balança & Prontos
            </h2>
            <p className="text-[11px] text-purple-200">
              Açaí: <strong>R$ {acaiPricePerKg.toFixed(2)}/kg</strong> • Sorvete:{' '}
              <strong>R$ {iceCreamPricePerKg.toFixed(2)}/kg</strong> (acompanhamentos pesados juntos)
            </p>
          </div>
        </div>

        <div className="flex bg-purple-950/80 p-1 rounded-xl border border-purple-700 gap-1">
          <button
            onClick={() => {
              setIsConfigUnlocked(false);
              setSubTab('pos');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              subTab === 'pos'
                ? 'bg-purple-600 text-white shadow'
                : 'text-purple-200 hover:text-white'
            }`}
          >
            <Scale size={14} /> Balança & Prontos
          </button>
          <button
            onClick={() => {
              setIsConfigUnlocked(false);
              setSubTab('orders');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              subTab === 'orders'
                ? 'bg-purple-600 text-white shadow'
                : 'text-purple-200 hover:text-white'
            }`}
          >
            <ClipboardList size={14} /> Pedidos & Caixa
            {pendingOnlineCount > 0 && (
              <span className="bg-green-500 text-black font-black text-[10px] px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingOnlineCount}
              </span>
            )}
          </button>
          <button
            onClick={handleClickConfigTab}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              subTab === 'config'
                ? 'bg-purple-600 text-white shadow'
                : 'text-purple-200 hover:text-white'
            }`}
          >
            <Lock size={13} /> Configurar & Fotos
          </button>
        </div>
      </div>

      {dbWarning && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-xs font-medium screen-only">
          ⚠️ Aviso: Execute o arquivo <code>supabase/migrations/20261020225000_acai_backend.sql</code> no SQL Editor do Supabase para ativar todas as tabelas de Açaí e Sorvete.
        </div>
      )}

      {/* MODAL DE RECIBO / VENDA CONCLUÍDA */}
      {lastReceipt && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <CheckCircle2 size={56} className="text-green-600 mx-auto" />
            <div>
              <h3 className="text-2xl font-black text-gray-800">Venda Registrada!</h3>
              <p className="text-sm text-gray-500">
                Pedido <strong>#{lastReceipt.orderNumber}</strong> salvo com sucesso.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left font-mono text-xs space-y-1">
              <div className="text-center font-bold border-b border-dashed border-gray-300 pb-2 mb-2">
                AÇAÍ & SORVETES — PEDIDO #{lastReceipt.orderNumber}
                <br />
                Operador: {lastReceipt.cashierName} | Cliente: {lastReceipt.customerName}
              </div>
              {(lastReceipt.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between py-0.5">
                  <span>1x {it.title}</span>
                  <span className="font-bold">R$ {Number(it.total).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-gray-300 pt-2 mt-2 flex justify-between text-sm font-black">
                <span>TOTAL ({String(lastReceipt.paymentMethod).toUpperCase()})</span>
                <span>R$ {Number(lastReceipt.total).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={18} /> Imprimir
              </button>
              <button
                onClick={() => setLastReceipt(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl cursor-pointer"
              >
                Nova Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 1: PDV (BALANÇA + COPOS/SORVETES PRONTOS + CARRINHO) */}
      {subTab === 'pos' && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* SEÇÃO 1: LANÇAMENTO PELA BALANÇA */}
            <section className="bg-white rounded-2xl shadow-sm border border-purple-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-black text-purple-950 uppercase flex items-center gap-2">
                    <Scale size={20} className="text-purple-700" /> 1. Pesagem na Balança (Self-Service no Kg)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Selecione se é Açaí ou Sorvete e digite o peso total em gramas que deu na balança.
                  </p>
                </div>

                <div className="flex bg-purple-100 p-1 rounded-xl border border-purple-200 gap-1">
                  <button
                    type="button"
                    onClick={() => setScaleType('acai')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      scaleType === 'acai'
                        ? 'bg-purple-700 text-white shadow'
                        : 'text-purple-900 hover:bg-purple-200'
                    }`}
                  >
                    💜 Açaí (R$ {acaiPricePerKg.toFixed(2)}/kg)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScaleType('sorvete')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      scaleType === 'sorvete'
                        ? 'bg-pink-600 text-white shadow'
                        : 'text-purple-900 hover:bg-purple-200'
                    }`}
                  >
                    🍦 Sorvete (R$ {iceCreamPricePerKg.toFixed(2)}/kg)
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddScaleItemToCart} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                  <div className="flex flex-col justify-between">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        Peso Total na Balança (Gramas)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          autoFocus
                          value={scaleGrams}
                          onChange={(e) => setScaleGrams(e.target.value)}
                          placeholder="Ex: 430"
                          className="w-full border-2 border-purple-300 focus:border-purple-600 rounded-xl px-4 py-3.5 text-3xl font-black text-gray-900 focus:outline-none"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                          gramas (g)
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={`mt-3 w-full text-white font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all ${
                        scaleType === 'sorvete'
                          ? 'bg-pink-600 hover:bg-pink-700'
                          : 'bg-purple-700 hover:bg-purple-800'
                      }`}
                    >
                      <Plus size={18} /> Lançar Peso de{' '}
                      {scaleType === 'sorvete' ? 'Sorvete' : 'Açaí'} no Pedido
                    </button>
                  </div>

                  <div className="bg-purple-950 text-white rounded-2xl p-5 flex flex-col justify-between border border-purple-800">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-purple-300">
                        <span>Modalidade:</span>
                        <span className="font-bold text-white uppercase">
                          {scaleType === 'sorvete' ? '🍦 Sorvete no Kg' : '💜 Açaí no Kg'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-purple-300">
                        <span>Peso na balança:</span>
                        <span className="font-bold text-white">{gramsNumber}g</span>
                      </div>
                      <div className="flex justify-between text-xs text-purple-300">
                        <span>Preço do Quilo:</span>
                        <span>R$ {activePricePerKg.toFixed(2)} / kg</span>
                      </div>
                    </div>
                    <div className="border-t border-purple-800 mt-4 pt-3 flex justify-between items-baseline">
                      <span className="text-xs uppercase font-bold text-purple-200">
                        Valor a Cobrar:
                      </span>
                      <span className="text-4xl font-black text-green-400">
                        R$ {calculateScaleTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </form>
            </section>

            {/* SEÇÃO 2: COPOS PRONTOS, CASQUINHAS E MILKSHAKES COM FOTO */}
            <section className="bg-white rounded-2xl shadow-sm border border-purple-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-base font-black text-purple-950 uppercase flex items-center gap-2">
                  <CupSoda size={20} className="text-purple-700" /> 2. Lançar Copos Prontos, Casquinhas & Milkshakes
                </h3>

                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'acai', label: '💜 Copos Açaí' },
                    { id: 'sorvete', label: '🍦 Sorvetes / Casquinhas' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCupFilter(f.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        cupFilter === f.id
                          ? 'bg-purple-700 text-white shadow'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SABORES DE SORVETE COM FOTO (Para marcar o sabor da Casquinha / Copo / Milkshake) */}
              {(cupFilter === 'todos' || cupFilter === 'sorvete') && flavors.length > 0 && (
                <div className="mb-4 p-3.5 rounded-xl bg-pink-50/70 border border-pink-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase text-pink-800 flex items-center gap-1.5">
                      <IceCream size={15} /> Sabores de Sorvete Disponíveis (Opcional: clique para marcar o sabor antes de lançar)
                    </span>
                    {selectedPosFlavors.length > 0 && (
                      <span className="text-[11px] font-bold bg-pink-600 text-white px-2.5 py-0.5 rounded-full">
                        Selecionados: {selectedPosFlavors.map((f) => f.name).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {flavors.map((fl) => {
                      const isSel = selectedPosFlavors.some((s) => s.id === fl.id);
                      return (
                        <button
                          key={fl.id}
                          type="button"
                          disabled={fl.out_of_stock}
                          onClick={() => handleTogglePosFlavor(fl)}
                          className={`p-2 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                            fl.out_of_stock
                              ? 'bg-gray-100 border-gray-200 opacity-40 cursor-not-allowed line-through'
                              : isSel
                              ? 'bg-pink-600 text-white border-pink-700 shadow'
                              : 'bg-white text-gray-800 border-pink-200 hover:border-pink-400'
                          }`}
                        >
                          {fl.image ? (
                            <img
                              src={fl.image}
                              alt={fl.name}
                              className="w-10 h-10 rounded-lg object-cover shrink-0 border border-pink-100"
                            />
                          ) : (
                            <span className="text-lg">🍦</span>
                          )}
                          <span className="truncate">{fl.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredCups.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Nenhum item cadastrado nesta categoria.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCups.map((cup) => {
                    const isSorvete = cup.category === 'sorvete';
                    return (
                      <button
                        key={cup.id}
                        type="button"
                        disabled={cup.out_of_stock}
                        onClick={() => handleAddReadyCupToCart(cup)}
                        className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                          cup.out_of_stock
                            ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                            : isSorvete
                            ? 'bg-pink-50/40 border-pink-200 hover:border-pink-500 hover:bg-pink-50 cursor-pointer shadow-sm'
                            : 'bg-purple-50/50 border-purple-200 hover:border-purple-600 hover:bg-purple-50 cursor-pointer shadow-sm'
                        }`}
                      >
                        <div className="w-full">
                          {cup.image && (
                            <div className="w-full h-28 rounded-lg overflow-hidden mb-2 bg-gray-100">
                              <img
                                src={cup.image}
                                alt={cup.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-black text-sm text-purple-950">
                              {isSorvete ? '🍦' : '💜'} {cup.name}
                            </span>
                            {cup.size_ml > 0 && (
                              <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full">
                                {cup.size_ml}ml
                              </span>
                            )}
                          </div>
                          {cup.description && (
                            <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                              {cup.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-purple-100 w-full">
                          <span className="text-base font-black text-green-700">
                            R$ {Number(cup.price || 0).toFixed(2)}
                          </span>
                          <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
                            <Plus size={14} /> Lançar
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* COLUNA DIREITA: ORDEM ATUAL NO CAIXA */}
          <div className="w-full md:w-96 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col">
            <div className="p-4 bg-purple-950 text-white">
              <h3 className="font-black text-base uppercase tracking-wide">
                💜🍦 Ordem Atual (Açaí & Sorvete)
              </h3>
              <p className="text-[11px] text-purple-300">
                Operador: <strong>{user?.name || 'Caixa'}</strong> • Salva em <code>acai_orders</code>
              </p>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do Cliente (Opcional - Padrão: Balcão)"
                className="mt-3 w-full bg-purple-900 border border-purple-700 rounded-lg px-3 py-2 text-xs text-white placeholder-purple-400 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-64 md:max-h-none">
              {acaiCart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs italic py-8">
                  Nenhum item lançado ainda.
                </div>
              ) : (
                acaiCart.map((item, index) => (
                  <div
                    key={item.id}
                    className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 flex items-start justify-between gap-2"
                  >
                    <div className="text-xs space-y-0.5">
                      <p className="font-black text-purple-950">
                        #{index + 1} — {item.title}
                      </p>
                      <p className="font-black text-green-700 text-sm pt-1">
                        R$ {Number(item.total).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveCartItem(item.id)}
                      className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'dinheiro', label: '💵 Dinheiro' },
                    { id: 'pix', label: '💠 PIX' },
                    { id: 'cartao', label: '💳 Cartão' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        paymentMethod === m.id
                          ? 'bg-purple-700 text-white border-purple-700 shadow'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'dinheiro' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                    Valor Recebido (Para calcular troco)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={changeAmount}
                    onChange={(e) => setChangeAmount(e.target.value)}
                    placeholder="Ex: 50.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold"
                  />
                  {changeAmount && Number(changeAmount) >= cartTotal && (
                    <p className="text-xs font-black text-green-700 mt-1">
                      Troco a devolver: R$ {(Number(changeAmount) - cartTotal).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold uppercase text-gray-500">Total:</span>
                <span className="text-2xl font-black text-purple-950">
                  R$ {cartTotal.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                disabled={savingSale || acaiCart.length === 0}
                onClick={handleFinishCashierAcaiSale}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-black py-3.5 rounded-xl shadow-lg text-sm uppercase tracking-wider cursor-pointer transition-all"
              >
                {savingSale ? 'Registrando...' : '✅ Finalizar Venda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 2: PEDIDOS & CAIXA DO DIA (ONLINE + BALCÃO) */}
      {subTab === 'orders' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-6xl w-full mx-auto space-y-6">
          {/* BARRA SUPERIOR: FILTRO DE DATA (APENAS SE TIVER PERMISSÃO DE RELATÓRIOS NO ADMIN) + ATUALIZAR */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div>
              <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight">
                {canViewReports
                  ? 'Caixa & Relatório do Dia (Açaí & Sorvetes)'
                  : 'Suas Vendas & Pedidos de Hoje (Açaí & Sorvetes)'}
              </h3>
              <p className="text-xs text-gray-500">
                {canViewReports
                  ? 'Visão completa de faturamento e pedidos (Operador com Acesso a Relatórios ativo no Admin).'
                  : 'Exibindo apenas suas vendas de hoje e pedidos online em andamento.'}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {canViewReports && (
                <>
                  <button
                    type="button"
                    onClick={() => setReportDate(todayStr)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black cursor-pointer"
                  >
                    HOJE
                  </button>
                  <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-1.5 flex-1 sm:flex-initial">
                    <Calendar size={15} className="text-purple-700" />
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="bg-transparent font-bold text-xs text-gray-800 focus:outline-none"
                    />
                  </div>
                </>
              )}
              <button
                onClick={loadOrders}
                className="px-3.5 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw size={14} /> Atualizar
              </button>
            </div>
          </div>

          {/* CARD PRINCIPAL DE FATURAMENTO DO DIA — APENAS SE TIVER PERMISSÃO DE RELATÓRIOS NO ADMIN */}
          {canViewReports && (
            <div className="bg-gradient-to-r from-purple-700 to-purple-900 p-6 md:p-8 rounded-3xl shadow-xl border border-purple-600 flex flex-col md:flex-row items-center justify-between gap-6 text-white text-center md:text-left">
              <div>
                <h3 className="text-purple-200 font-bold text-xs uppercase tracking-[0.2em] mb-2">
                  {effectiveDate === todayStr
                    ? 'Faturamento de Hoje (Açaí & Sorvete)'
                    : `Vendas em ${new Date(effectiveDate + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                </h3>
                <p className="text-4xl md:text-5xl font-black">
                  R$ {totalDiaGeral.toFixed(2)}
                </p>
                <p className="text-purple-200 text-sm mt-2 font-medium">
                  {validDailyOrders.length} pedido(s) realizado(s) nesta data
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <div className="bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md border border-white/20 text-left">
                  <span className="text-[10px] uppercase font-bold text-purple-200 block">💵 Dinheiro</span>
                  <span className="text-base font-black text-white">R$ {totalDinheiro.toFixed(2)}</span>
                </div>
                <div className="bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md border border-white/20 text-left">
                  <span className="text-[10px] uppercase font-bold text-purple-200 block">💠 PIX</span>
                  <span className="text-base font-black text-white">R$ {totalPix.toFixed(2)}</span>
                </div>
                <div className="bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md border border-white/20 text-left">
                  <span className="text-[10px] uppercase font-bold text-purple-200 block">💳 Cartão</span>
                  <span className="text-base font-black text-white">R$ {totalCartao.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* CARDS DE RESUMO DO DIA BASEADOS NA PERMISSÃO DO OPERADOR (Igual ao Caixa da Pizzaria) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CARD 1: SUAS VENDAS (Sempre visível para o operador) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
              <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">
                Suas Vendas ({effectiveDate === todayStr ? 'Hoje' : 'Na Data'})
              </h3>
              <p className="text-2xl font-black text-blue-600">
                R$ {totalSuasVendas.toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-500 mt-1 font-bold italic">
                Processado por {user?.name || 'você'}
              </p>
            </div>

            {/* CARDS ADICIONAIS: APENAS SE AUTORIZADO NO ADMIN (user.can_view_reports) */}
            {canViewReports ? (
              <>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-500">
                  <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">
                    Cardápio Online
                  </h3>
                  <p className="text-2xl font-black text-green-600">
                    R$ {totalCardapioOnline.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 font-bold italic">
                    Vendas em /cardapio/acai
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500">
                  <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">
                    Outros Operadores
                  </h3>
                  <p className="text-2xl font-black text-purple-600">
                    R$ {totalOutrosOperadores.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 font-bold italic">
                    Vendas de outros caixas
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-600">
                  <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">
                    Total Geral (Dia)
                  </h3>
                  <p className="text-2xl font-black text-green-700">
                    R$ {totalDiaGeral.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 font-bold italic">
                    Soma de todas as vendas do dia
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1">
                  Seus Pedidos (Hoje)
                </h3>
                <p className="text-2xl font-black text-gray-800">
                  {suasVendasHojeList.length}
                </p>
                <p className="text-[10px] text-gray-500 mt-1 font-bold italic">
                  Sua quantidade de vendas no caixa hoje
                </p>
              </div>
            )}
          </div>

          {/* LISTA DE PEDIDOS DO DIA SELECIONADO */}
          {loadingOrders ? (
            <p className="text-center text-gray-500 py-8 text-sm">Carregando pedidos...</p>
          ) : dailyOrders.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border border-gray-200 font-bold italic text-sm">
              Nenhum pedido encontrado nesta data ({new Date(effectiveDate + 'T12:00:00').toLocaleDateString('pt-BR')}).
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dailyOrders.map((ord) => {
                const isOnline = !ord.cashier_name;
                return (
                  <div
                    key={ord.id}
                    className={`bg-white rounded-xl p-4 border-2 shadow-sm space-y-3 ${
                      isOnline && ord.status === 'pending'
                        ? 'border-purple-500'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-lg text-gray-900">
                            #{ord.order_number} — {ord.customer_name}
                          </span>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isOnline
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isOnline ? '📱 Cardápio Online' : `🏪 Caixa (${ord.cashier_name})`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {ord.created_at
                            ? new Date(ord.created_at).toLocaleString('pt-BR')
                            : ''}{' '}
                          {ord.customer_phone ? `• Tel: ${ord.customer_phone}` : ''}
                        </p>
                      </div>
                      <span className="text-lg font-black text-green-700">
                        R$ {Number(ord.total || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200 space-y-1">
                      <p>
                        <strong>Local:</strong> {ord.customer_address || 'Balcão'} |{' '}
                        <strong>Pgto:</strong>{' '}
                        {String(ord.payment_method || '')
                          .replace(/^online_/i, '')
                          .toUpperCase()}
                      </p>
                      <div className="border-t border-gray-200 pt-1.5 mt-1.5 space-y-1">
                        {Array.isArray(ord.items) && ord.items.length > 0 ? (
                          ord.items.map((it, idx) => {
                            const rawNote =
                              it.notes !== undefined
                                ? it.notes
                                : it.observation &&
                                  !it.observation.includes('Sabores:') &&
                                  !it.observation.includes('Acomp:')
                                ? it.observation
                                : '';
                            return (
                              <div key={idx}>
                                • <strong>{it.title || it.name || `Açaí ${it.grams}g`}</strong> — R${' '}
                                {Number(it.total ?? it.price ?? 0).toFixed(2)}
                                {it.flavors?.length > 0 &&
                                  ` [Sabores: ${it.flavors.join(', ')}]`}
                                {it.addons?.length > 0 &&
                                  ` (Acompanhamentos: ${it.addons.map((a) => a.name).join(', ')})`}
                                {rawNote && ` [Obs: ${rawNote}]`}
                              </div>
                            );
                          })
                        ) : (
                          <div>
                            • <strong>Açaí {ord.grams}g</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <select
                        value={ord.status || 'pending'}
                        onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value)}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-800 bg-white"
                      >
                        <option value="pending">⏳ Pendente</option>
                        <option value="preparing">🥣 Preparando</option>
                        <option value="ready">✅ Pronto / Saiu p/ Entrega</option>
                        <option value="finished">🏁 Finalizado</option>
                        <option value="cancelled">❌ Cancelado</option>
                      </select>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const formatted = formatOrderForSystemPrint(ord);
                            if (onPrintOrder) {
                              onPrintOrder(formatted, false);
                            } else {
                              setLastReceipt(formatted);
                            }
                          }}
                          className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                          title="Reimprimir comprovante"
                        >
                          <Printer size={14} /> Imprimir
                        </button>
                        {canViewReports && (
                          <button
                            onClick={() => handleRequestDeleteOrder(ord)}
                            className="text-red-500 hover:text-red-700 p-1.5 cursor-pointer"
                            title="Excluir pedido (Requer Senha do Admin)"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-ABA 3: CONFIGURAR & FOTOS (PROTEGIDA POR SENHA DO ADMIN) */}
      {subTab === 'config' && isConfigUnlocked && (
        <div className="flex-1 overflow-y-auto p-4 max-w-5xl w-full mx-auto space-y-6">
          <div className="flex items-center justify-between bg-purple-100 border border-purple-300 px-4 py-2.5 rounded-xl text-xs">
            <span className="font-bold text-purple-900 flex items-center gap-1.5">
              🔓 Modo Administrador Desbloqueado — Edição de Preços, Produtos e Fotos
            </span>
            <button
              type="button"
              onClick={() => {
                setIsConfigUnlocked(false);
                setSubTab('pos');
              }}
              className="bg-purple-800 hover:bg-purple-900 text-white font-bold px-3 py-1 rounded-lg cursor-pointer flex items-center gap-1"
            >
              <Lock size={12} /> Bloquear Config
            </button>
          </div>
          {/* 1. PREÇO DO KG, FOTOS DE CAPA (AÇAÍ E SORVETE NO KG) & CONFIGURAÇÕES */}
          <form
            onSubmit={handleSaveSettings}
            className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4"
          >
            <h3 className="font-black text-sm uppercase text-purple-950">
              ⚙️ Preço do Quilo, Fotos de Capa & Cardápio Online
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-bold text-purple-800 mb-1">
                  💜 Preço do Kg — Açaí (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settingsForm.price_per_kg}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, price_per_kg: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold text-gray-900"
                />
              </div>
              <div>
                <label className="block font-bold text-pink-700 mb-1">
                  🍦 Preço do Kg — Sorvete (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settingsForm.ice_cream_price_per_kg}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      ice_cream_price_per_kg: e.target.value
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold text-gray-900"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-600 mb-1">
                  Peso Mínimo no Online (g)
                </label>
                <input
                  type="number"
                  required
                  value={settingsForm.min_grams}
                  onChange={(e) => setSettingsForm({ ...settingsForm, min_grams: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold text-gray-900"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-600 mb-1">
                  WhatsApp Pedidos Online
                </label>
                <input
                  type="text"
                  value={settingsForm.whatsapp_number}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, whatsapp_number: e.target.value })
                  }
                  placeholder="Ex: 5563991038781"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                />
              </div>
            </div>

            {/* Fotos de capa do Açaí no Kg e Sorvete no Kg */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
              <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200 space-y-2">
                <label className="block font-bold text-purple-900">
                  📷 Foto do Açaí no Quilo (Opcional)
                </label>
                <div className="flex items-center gap-2">
                  {settingsForm.acai_image && (
                    <img
                      src={settingsForm.acai_image}
                      alt="Açaí"
                      className="w-12 h-12 rounded-lg object-cover border border-purple-300 shrink-0"
                    />
                  )}
                  <input
                    type="text"
                    placeholder="Cole o link da foto ou envie do aparelho..."
                    value={settingsForm.acai_image}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, acai_image: e.target.value })
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white"
                  />
                  <label className="bg-purple-700 hover:bg-purple-800 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer flex items-center gap-1 shrink-0">
                    <Camera size={14} />
                    {uploadingField === 'acai_image' ? '...' : 'Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e.target.files?.[0], 'acai_image', (url) =>
                          setSettingsForm((prev) => ({ ...prev, acai_image: url }))
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="bg-pink-50/60 p-3 rounded-xl border border-pink-200 space-y-2">
                <label className="block font-bold text-pink-900">
                  📷 Foto do Sorvete no Quilo (Opcional)
                </label>
                <div className="flex items-center gap-2">
                  {settingsForm.ice_cream_image && (
                    <img
                      src={settingsForm.ice_cream_image}
                      alt="Sorvete"
                      className="w-12 h-12 rounded-lg object-cover border border-pink-300 shrink-0"
                    />
                  )}
                  <input
                    type="text"
                    placeholder="Cole o link da foto ou envie do aparelho..."
                    value={settingsForm.ice_cream_image}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, ice_cream_image: e.target.value })
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white"
                  />
                  <label className="bg-pink-600 hover:bg-pink-700 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer flex items-center gap-1 shrink-0">
                    <Camera size={14} />
                    {uploadingField === 'ice_cream_image' ? '...' : 'Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e.target.files?.[0], 'ice_cream_image', (url) =>
                          setSettingsForm((prev) => ({ ...prev, ice_cream_image: url }))
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setSettingsForm({ ...settingsForm, is_open: !settingsForm.is_open })
                }
                className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  settingsForm.is_open
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}
              >
                Cardápio Online (/cardapio/acai):{' '}
                {settingsForm.is_open ? '🟢 Aberto' : '🔴 Fechado'}
              </button>

              <button
                type="submit"
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-5 py-2 rounded-xl text-xs cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </form>

          {/* 2. GERENCIAR COPOS PRONTOS, CASQUINHAS E MILKSHAKES (COM FOTO) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-black text-sm uppercase text-purple-950">
              🥤 Copos Prontos, Casquinhas & Milkshakes (Com Foto)
            </h3>

            <form
              onSubmit={handleSaveCup}
              className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-purple-50 p-3 rounded-xl border border-purple-200 text-xs"
            >
              <input
                type="text"
                required
                placeholder="Nome (ex: Cascão 2 Bolas)"
                value={cupForm.name}
                onChange={(e) => setCupForm({ ...cupForm, name: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
              <select
                value={cupForm.category}
                onChange={(e) => setCupForm({ ...cupForm, category: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white font-bold"
              >
                <option value="acai">💜 Categoria: Açaí</option>
                <option value="sorvete">🍦 Categoria: Sorvete</option>
              </select>
              <input
                type="number"
                placeholder="Tamanho ml (ex: 300)"
                value={cupForm.size_ml}
                onChange={(e) => setCupForm({ ...cupForm, size_ml: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
              <input
                type="number"
                step="0.01"
                required
                placeholder="Preço R$ (ex: 15.00)"
                value={cupForm.price}
                onChange={(e) => setCupForm({ ...cupForm, price: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
              <input
                type="text"
                placeholder="Descrição (itens inclusos)"
                value={cupForm.description}
                onChange={(e) => setCupForm({ ...cupForm, description: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white sm:col-span-2"
              />

              {/* Campo de Foto do Produto */}
              <div className="flex items-center gap-1.5 sm:col-span-2">
                {cupForm.image && (
                  <img
                    src={cupForm.image}
                    alt="Preview"
                    className="w-9 h-9 rounded-lg object-cover border border-purple-300 shrink-0"
                  />
                )}
                <input
                  type="text"
                  placeholder="Link da foto ou clique em Foto..."
                  value={cupForm.image}
                  onChange={(e) => setCupForm({ ...cupForm, image: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white"
                />
                <label className="bg-purple-700 hover:bg-purple-800 text-white px-3 py-2 rounded-lg font-bold cursor-pointer flex items-center gap-1 shrink-0">
                  <Camera size={14} />
                  {uploadingField === 'cup_image' ? '...' : 'Foto'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleFileUpload(e.target.files?.[0], 'cup_image', (url) =>
                        setCupForm((prev) => ({ ...prev, image: url }))
                      )
                    }
                  />
                </label>
              </div>

              <div className="flex gap-1 sm:col-span-4 pt-1">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg cursor-pointer"
                >
                  {cupForm.id ? 'Salvar Alterações do Produto' : '+ Cadastrar Produto Pronto'}
                </button>
                {cupForm.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setCupForm({
                        id: null,
                        name: '',
                        category: 'acai',
                        size_ml: 300,
                        description: '',
                        price: '',
                        image: '',
                        out_of_stock: false
                      })
                    }
                    className="bg-gray-200 px-4 rounded-lg font-bold"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-2">
              {cups.map((cup) => (
                <div
                  key={cup.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200 text-xs gap-3"
                >
                  <div className="flex items-center gap-3">
                    {cup.image ? (
                      <img
                        src={cup.image}
                        alt={cup.name}
                        className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-lg shrink-0">
                        {cup.category === 'sorvete' ? '🍦' : '💜'}
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-gray-900">
                        {cup.category === 'sorvete' ? '🍦' : '💜'} {cup.name}{' '}
                        {cup.size_ml ? `(${cup.size_ml}ml)` : ''}
                      </span>{' '}
                      —{' '}
                      <span className="font-black text-green-700">
                        R$ {Number(cup.price).toFixed(2)}
                      </span>
                      {cup.description && <p className="text-gray-500">{cup.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleCupStock(cup)}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                        cup.out_of_stock
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {cup.out_of_stock ? 'Esgotado' : 'Disponível'}
                    </button>
                    <button
                      onClick={() =>
                        setCupForm({
                          id: cup.id,
                          name: cup.name,
                          category: cup.category || 'acai',
                          size_ml: cup.size_ml,
                          description: cup.description || '',
                          price: cup.price,
                          image: cup.image || '',
                          out_of_stock: cup.out_of_stock
                        })
                      }
                      className="p-1 text-gray-500 hover:text-gray-900 cursor-pointer"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteCup(cup.id)}
                      className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. GERENCIAR SABORES DE SORVETE (COM FOTO OPCIONAL) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-black text-sm uppercase text-pink-700 flex items-center gap-1.5">
              <IceCream size={16} /> Sabores de Sorvete (Cardápio Online)
            </h3>

            <form
              onSubmit={handleSaveFlavor}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-pink-50/60 p-3 rounded-xl border border-pink-200 text-xs"
            >
              <input
                type="text"
                required
                placeholder="Nome do sabor (ex: Flocos, Ninho Trufado)"
                value={flavorForm.name}
                onChange={(e) => setFlavorForm({ ...flavorForm, name: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
              <div className="flex items-center gap-1.5">
                {flavorForm.image && (
                  <img
                    src={flavorForm.image}
                    alt="Preview"
                    className="w-8 h-8 rounded object-cover shrink-0"
                  />
                )}
                <input
                  type="text"
                  placeholder="Foto do sabor (opcional)"
                  value={flavorForm.image}
                  onChange={(e) => setFlavorForm({ ...flavorForm, image: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white"
                />
                <label className="bg-pink-600 hover:bg-pink-700 text-white px-2.5 py-2 rounded-lg font-bold cursor-pointer flex items-center gap-1 shrink-0">
                  <Camera size={14} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleFileUpload(e.target.files?.[0], 'flavor_image', (url) =>
                        setFlavorForm((prev) => ({ ...prev, image: url }))
                      )
                    }
                  />
                </label>
              </div>
              <button
                type="submit"
                className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-lg cursor-pointer"
              >
                {flavorForm.id ? 'Salvar Sabor' : '+ Adicionar Sabor'}
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {flavors.map((fl) => (
                <div
                  key={fl.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 text-xs"
                >
                  <div className="flex items-center gap-2">
                    {fl.image ? (
                      <img
                        src={fl.image}
                        alt={fl.name}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    ) : (
                      <span>🍦</span>
                    )}
                    <span className="font-bold text-gray-800">{fl.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleFlavorStock(fl)}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                        fl.out_of_stock
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {fl.out_of_stock ? 'Esgotado' : 'Ativo'}
                    </button>
                    <button
                      onClick={() =>
                        setFlavorForm({
                          id: fl.id,
                          name: fl.name,
                          image: fl.image || '',
                          out_of_stock: fl.out_of_stock
                        })
                      }
                      className="p-1 text-gray-500 hover:text-gray-900 cursor-pointer"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteFlavor(fl.id)}
                      className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. GERENCIAR ACOMPANHAMENTOS & CALDAS (COM FOTO OPCIONAL) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-sm uppercase text-purple-950">
                🍓 Acompanhamentos & Caldas (Montagem do Pote no Online)
              </h3>
              <p className="text-xs text-gray-500">
                Os itens marcados como "Incluso no peso" são colocados junto no pote na balança até atingir as gramas escolhidas pelo cliente.
              </p>
            </div>

            <form
              onSubmit={handleSaveAddon}
              className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-purple-50 p-3 rounded-xl border border-purple-200 text-xs"
            >
              <input
                type="text"
                required
                placeholder="Nome (ex: Calda de Chocolate)"
                value={addonForm.name}
                onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
              <select
                value={addonForm.type}
                onChange={(e) => setAddonForm({ ...addonForm, type: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="incluso">Incluso no peso</option>
                <option value="pago">Extra Pago (+ R$)</option>
              </select>
              {addonForm.type === 'pago' ? (
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Preço R$ (ex: 4.00)"
                  value={addonForm.price}
                  onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                />
              ) : (
                <div className="px-3 py-2 text-gray-500 italic flex items-center">
                  Pesado junto no pote
                </div>
              )}

              <div className="flex items-center gap-1">
                {addonForm.image && (
                  <img
                    src={addonForm.image}
                    alt="Preview"
                    className="w-8 h-8 rounded object-cover shrink-0"
                  />
                )}
                <input
                  type="text"
                  placeholder="Foto (opcional)"
                  value={addonForm.image}
                  onChange={(e) => setAddonForm({ ...addonForm, image: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-2 bg-white"
                />
                <label className="bg-purple-700 hover:bg-purple-800 text-white px-2.5 py-2 rounded-lg font-bold cursor-pointer flex items-center shrink-0">
                  <Camera size={14} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleFileUpload(e.target.files?.[0], 'addon_image', (url) =>
                        setAddonForm((prev) => ({ ...prev, image: url }))
                      )
                    }
                  />
                </label>
              </div>

              <div className="flex gap-1 sm:col-span-4 pt-1">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg cursor-pointer"
                >
                  {addonForm.id ? 'Salvar Acompanhamento' : '+ Adicionar Acompanhamento'}
                </button>
                {addonForm.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setAddonForm({
                        id: null,
                        name: '',
                        type: 'incluso',
                        price: '',
                        image: '',
                        out_of_stock: false
                      })
                    }
                    className="bg-gray-200 px-3 rounded-lg"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-2">
              {addons.map((addon) => (
                <div
                  key={addon.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {addon.image && (
                      <img
                        src={addon.image}
                        alt={addon.name}
                        className="w-9 h-9 rounded-lg object-cover border border-gray-200"
                      />
                    )}
                    <div>
                      <span className="font-bold text-gray-900">{addon.name}</span>{' '}
                      <span className="text-gray-500">
                        ({addon.type === 'pago' ? `Extra + R$ ${Number(addon.price).toFixed(2)}` : 'Incluso no peso'})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAddonStock(addon)}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                        addon.out_of_stock
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {addon.out_of_stock ? 'Esgotado' : 'Disponível'}
                    </button>
                    <button
                      onClick={() =>
                        setAddonForm({
                          id: addon.id,
                          name: addon.name,
                          type: addon.type,
                          price: addon.price,
                          image: addon.image || '',
                          out_of_stock: addon.out_of_stock
                        })
                      }
                      className="p-1 text-gray-500 hover:text-gray-900 cursor-pointer"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteAddon(addon.id)}
                      className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

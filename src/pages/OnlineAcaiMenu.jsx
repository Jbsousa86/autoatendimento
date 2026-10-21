import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  MessageCircle,
  X,
  MapPin,
  User,
  Phone,
  Clock,
  Scale,
  CupSoda,
  IceCream
} from 'lucide-react';
import {
  acaiService,
  DEFAULT_ACAI_SETTINGS,
  DEFAULT_ACAI_ADDONS,
  DEFAULT_ACAI_FLAVORS,
  DEFAULT_ACAI_CUPS
} from '../services/acaiApi';

export default function OnlineAcaiMenu() {
  const [settings, setSettings] = useState(DEFAULT_ACAI_SETTINGS);
  const [adicionais, setAdicionais] = useState(DEFAULT_ACAI_ADDONS);
  const [saboresSorvete, setSaboresSorvete] = useState(DEFAULT_ACAI_FLAVORS);
  const [coposProntos, setCoposProntos] = useState(DEFAULT_ACAI_CUPS);
  const [loadingData, setLoadingData] = useState(true);
  const [zoomImage, setZoomImage] = useState(null);

  // Modo principal: 'copos' (Copos Prontos / Casquinhas / Milkshakes) | 'quilo' (Montar por Peso)
  const [modoCardapio, setModoCardapio] = useState('copos');

  // Tipo de montagem no Quilo: 'acai' | 'sorvete' | 'misto'
  const [tipoQuilo, setTipoQuilo] = useState('acai');
  const [gramas, setGramas] = useState(300);
  const [saboresSelecionados, setSaboresSelecionados] = useState([]);
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState([]);
  const [observacaoPote, setObservacaoPote] = useState('');

  // Filtro na aba de Copos Prontos: 'todos' | 'acai' | 'sorvete'
  const [filtroCopos, setFiltroCopos] = useState('todos');

  // Sacola de itens
  const [sacola, setSacola] = useState([]);

  // Checkout Modal e Dados do Cliente
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState('entrega'); // 'entrega' | 'retirada'
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(''); // 'pix' | 'cartao' | 'dinheiro'
  const [changeAmount, setChangeAmount] = useState('');
  const [generalObservation, setGeneralObservation] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  useEffect(() => {
    const carregarDados = async () => {
      setLoadingData(true);
      try {
        const [loadedSettings, loadedAddons, loadedFlavors, loadedCups] = await Promise.all([
          acaiService.getSettings(),
          acaiService.getAddons(),
          acaiService.getFlavors(),
          acaiService.getCups()
        ]);

        setSettings(loadedSettings);
        setGramas(loadedSettings.min_grams || 300);
        setAdicionais(loadedAddons);
        setSaboresSorvete(loadedFlavors);
        setCoposProntos(loadedCups);
      } catch (err) {
        console.error('Erro ao carregar cardápio de açaí e sorvete:', err);
      } finally {
        setLoadingData(false);
      }
    };

    carregarDados();
  }, []);

  const precoAcaiKg = Number(settings.price_per_kg || 60);
  const precoSorveteKg = Number(settings.ice_cream_price_per_kg || settings.price_per_kg || 50);
  const precoPorKgAtual =
    tipoQuilo === 'sorvete' ? precoSorveteKg : Math.max(precoAcaiKg, precoSorveteKg);

  const minGramas = Number(settings.min_grams || 300);
  const passoGramas = Number(settings.step_grams || 50);
  const opcoesPeso =
    Array.isArray(settings.weight_options) && settings.weight_options.length > 0
      ? settings.weight_options
      : [300, 400, 500, 1000];

  const handleToggleSabor = (sabor) => {
    if (sabor.out_of_stock) return;
    const jaSelecionado = saboresSelecionados.some((s) => s.id === sabor.id);
    if (jaSelecionado) {
      setSaboresSelecionados(saboresSelecionados.filter((s) => s.id !== sabor.id));
    } else {
      setSaboresSelecionados([...saboresSelecionados, sabor]);
      if (modoCardapio === 'quilo' && tipoQuilo === 'acai') {
        setTipoQuilo('misto');
      }
    }
  };

  const handleToggleAdicional = (adicional) => {
    if (adicional.out_of_stock) return;
    if (adicionaisSelecionados.some((item) => item.id === adicional.id)) {
      setAdicionaisSelecionados(adicionaisSelecionados.filter((item) => item.id !== adicional.id));
    } else {
      setAdicionaisSelecionados([...adicionaisSelecionados, adicional]);
    }
  };

  const alterarGramas = (delta) => {
    setGramas((atual) => Math.max(minGramas, atual + delta));
  };

  const calcularTotalPoteAtual = () => {
    const precoBase = (precoPorKgAtual / 1000) * gramas;
    const totalAdicionais = adicionaisSelecionados.reduce(
      (acc, item) =>
        acc + (item.type === 'pago' || item.tipo === 'pago' ? Number(item.price ?? item.preco ?? 0) : 0),
      0
    );
    return Number((precoBase + totalAdicionais).toFixed(2));
  };

  const getLabelTipoQuilo = () => {
    if (tipoQuilo === 'sorvete') return 'Sorvete no Quilo';
    if (tipoQuilo === 'misto') return 'Açaí + Sorvete no Quilo';
    return 'Açaí no Quilo';
  };

  const criarObjetoPoteQuilo = () => {
    const title = `${getLabelTipoQuilo()} (${gramas}g)`;
    const total = calcularTotalPoteAtual();
    const flavorsList =
      tipoQuilo === 'sorvete' || tipoQuilo === 'misto'
        ? saboresSelecionados.map((s) => s.name)
        : [];
    const addonsList = adicionaisSelecionados.map((a) => ({
      id: a.id,
      name: a.name || a.nome,
      type: a.type || a.tipo || 'incluso',
      price: Number(a.price ?? a.preco ?? 0)
    }));
    const notes = observacaoPote.trim();
    const obsParts = [];
    if (flavorsList.length > 0) {
      obsParts.push(`Sabores: ${flavorsList.join(', ')}`);
    }
    if (addonsList.length > 0) {
      obsParts.push(`Acomp: ${addonsList.map((a) => a.name).join(', ')}`);
    }
    if (notes) {
      obsParts.push(notes);
    }

    return {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'quilo',
      product_type: tipoQuilo,
      qty: 1,
      name: title,
      title,
      price: total,
      grams: gramas,
      price_per_kg: precoPorKgAtual,
      flavors: flavorsList,
      addons: addonsList,
      notes,
      observation: obsParts.join(' | '),
      total
    };
  };

  const handleAdicionarPoteQuiloNaSacola = () => {
    if ((tipoQuilo === 'sorvete' || tipoQuilo === 'misto') && saboresSelecionados.length === 0) {
      alert('Escolha pelo menos 1 sabor de sorvete para montar seu pote!');
      return;
    }
    const novoPote = criarObjetoPoteQuilo();
    setSacola((prev) => [...prev, novoPote]);
    setGramas(minGramas);
    setSaboresSelecionados([]);
    setAdicionaisSelecionados([]);
    setObservacaoPote('');
  };

  const handleAdicionarCopoPronto = (copo) => {
    if (copo.out_of_stock) return;
    const isSorvete = (copo.category || 'acai') === 'sorvete';
    const flavorsList = isSorvete ? saboresSelecionados.map((s) => s.name) : [];
    const price = Number(copo.price || 0);
    const obsParts = [];
    if (flavorsList.length > 0) {
      obsParts.push(`Sabores: ${flavorsList.join(', ')}`);
    }

    const novoCopo = {
      id: `cup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'copo_pronto',
      product_type: copo.category || 'acai',
      cup_id: copo.id,
      qty: 1,
      name: copo.name,
      title: copo.name,
      price,
      size_ml: Number(copo.size_ml || 300),
      description: copo.description || '',
      image: copo.image || '',
      grams: 0,
      flavors: flavorsList,
      addons: [],
      notes: '',
      observation: obsParts.join(' | '),
      total: price
    };
    setSacola((prev) => [...prev, novoCopo]);
  };

  const handleRemoverDaSacola = (id) => {
    setSacola((prev) => prev.filter((item) => item.id !== id));
  };

  const calcularTotalPedido = () => {
    const totalSacola = sacola.reduce((acc, item) => acc + Number(item.total || 0), 0);
    if (sacola.length === 0) {
      return modoCardapio === 'quilo' ? calcularTotalPoteAtual() : 0;
    }
    return Number(totalSacola.toFixed(2));
  };

  const handleAbrirCheckout = () => {
    if (sacola.length === 0) {
      if (modoCardapio === 'quilo') {
        if ((tipoQuilo === 'sorvete' || tipoQuilo === 'misto') && saboresSelecionados.length === 0) {
          alert('Escolha pelo menos 1 sabor de sorvete para montar seu pote!');
          return;
        }
        setSacola([criarObjetoPoteQuilo()]);
      } else {
        alert('Selecione pelo menos um item ou monte seu pote no quilo para continuar.');
        return;
      }
    }
    setShowCheckoutModal(true);
  };

  const handleFinalizarPedido = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Por favor, informe seu nome.');
      return;
    }
    if (deliveryType === 'entrega' && !customerAddress.trim()) {
      alert('Por favor, informe o endereço de entrega.');
      return;
    }
    if (!paymentMethod) {
      alert('Por favor, selecione a forma de pagamento.');
      return;
    }

    const itensFinais = sacola.length > 0 ? sacola : [criarObjetoPoteQuilo()];
    const totalFinal = itensFinais.reduce((acc, item) => acc + Number(item.total || 0), 0);

    if (paymentMethod === 'dinheiro' && changeAmount && Number(changeAmount) < totalFinal) {
      alert('O valor para troco deve ser maior ou igual ao total do pedido.');
      return;
    }

    const primeiroItem = itensFinais[0];
    const orderNumber = String(Math.floor(Math.random() * 900) + 100);

    const payload = {
      orderNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryType,
      customerAddress: deliveryType === 'entrega' ? customerAddress.trim() : 'Retirada no Local',
      paymentMethod: `online_${paymentMethod}`,
      changeAmount: paymentMethod === 'dinheiro' && changeAmount ? Number(changeAmount) : null,
      observation: generalObservation.trim(),
      grams: itensFinais.reduce((acc, item) => acc + Number(item.grams || 0), 0),
      pricePerKg: precoPorKgAtual,
      addons: primeiroItem?.addons || [],
      items: itensFinais,
      total: Number(totalFinal.toFixed(2))
    };

    setSavingOrder(true);
    try {
      const { data, error } = await acaiService.createOrder(payload);
      if (error) {
        alert(`Não foi possível registrar o pedido no momento (${error.message}).`);
        return;
      }

      setCompletedOrder({
        ...payload,
        id: data?.id
      });
      setShowCheckoutModal(false);
      setSacola([]);
      setSaboresSelecionados([]);
      setAdicionaisSelecionados([]);
      setObservacaoPote('');
    } catch (err) {
      console.error('Erro ao finalizar pedido:', err);
      alert('Erro inesperado ao enviar pedido.');
    } finally {
      setSavingOrder(false);
    }
  };

  const voltarParaTelaPrincipal = () => {
    setCompletedOrder(null);
    setModoCardapio('copos');
    setTipoQuilo('acai');
    setGramas(minGramas);
    setPaymentMethod('');
    setChangeAmount('');
    setGeneralObservation('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEnviarWhatsApp = (pedido) => {
    if (!pedido) return;
    const waNum = (settings.whatsapp_number || '').replace(/\D/g, '') || '5563991038781';

    let msg = `*💜🍦 NOVO PEDIDO (AÇAÍ & SORVETE) #${pedido.orderNumber}*\n\n`;
    msg += `*Cliente:* ${pedido.customerName}\n`;
    if (pedido.customerPhone) msg += `*Telefone:* ${pedido.customerPhone}\n`;
    msg += `*Modalidade:* ${pedido.deliveryType === 'retirada' ? 'Retirada no Local' : 'Entrega'}\n`;
    if (pedido.deliveryType === 'entrega') {
      msg += `*Endereço:* ${pedido.customerAddress}\n`;
    }
    msg += `------------------------------\n`;

    (pedido.items || []).forEach((item, idx) => {
      msg += `*${idx + 1}. ${item.title || item.name}* — R$ ${Number(item.total ?? item.price ?? 0).toFixed(2)}\n`;
      if (item.kind === 'copo_pronto') {
        if (item.description) msg += `   _${item.description}_\n`;
        if (item.flavors && item.flavors.length > 0) {
          msg += `   _Sabores de Sorvete:_ ${item.flavors.join(', ')}\n`;
        }
      } else {
        if (item.flavors && item.flavors.length > 0) {
          msg += `   _Sabores de Sorvete:_ ${item.flavors.join(', ')}\n`;
        }
        if (item.addons && item.addons.length > 0) {
          const nomesAdicionais = item.addons
            .map((a) => (a.type === 'pago' ? `${a.name} (+R$ ${Number(a.price).toFixed(2)})` : a.name))
            .join(', ');
          msg += `   _Acompanhamentos:_ ${nomesAdicionais}\n`;
        } else {
          msg += `   _Sem acompanhamentos_\n`;
        }
      }
      const rawNote = item.notes !== undefined ? item.notes : item.observation;
      if (rawNote && !rawNote.includes('Sabores:') && !rawNote.includes('Acomp:')) {
        msg += `   _Obs:_ ${rawNote}\n`;
      }
      msg += `\n`;
    });

    msg += `------------------------------\n`;
    if (pedido.observation) {
      msg += `*Observação Geral:* ${pedido.observation}\n`;
    }
    const pgtoDisplay = String(pedido.paymentMethod || '')
      .replace(/^online_/i, '')
      .toUpperCase();
    msg += `*Pagamento:* ${pgtoDisplay}\n`;
    if (pgtoDisplay.includes('DINHEIRO') && pedido.changeAmount) {
      const troco = Number(pedido.changeAmount) - Number(pedido.total);
      msg += `*Troco para:* R$ ${Number(pedido.changeAmount).toFixed(2)} (Levar R$ ${Math.max(0, troco).toFixed(2)})\n`;
    }
    msg += `*TOTAL: R$ ${Number(pedido.total).toFixed(2)}*\n`;

    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');

    setTimeout(() => {
      voltarParaTelaPrincipal();
    }, 1000);
  };

  const coposFiltrados = coposProntos.filter((c) => {
    if (filtroCopos === 'todos') return true;
    return (c.category || 'acai') === filtroCopos;
  });

  if (completedOrder) {
    return (
      <div className="min-h-screen bg-purple-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-purple-900/60 border border-purple-700 rounded-3xl p-8 shadow-2xl space-y-6">
          <CheckCircle2 size={72} className="text-green-400 mx-auto" />
          <div>
            <span className="text-xs uppercase tracking-widest text-purple-300 font-bold">
              Pedido Registrado com Sucesso
            </span>
            <h1 className="text-4xl font-black mt-1">Pedido #{completedOrder.orderNumber}</h1>
            <p className="text-purple-200 text-sm mt-2">
              Clique no botão abaixo para enviar a confirmação no WhatsApp e agilizar o preparo!
            </p>
          </div>

          <div className="bg-purple-950/70 rounded-2xl p-4 text-left text-sm space-y-2 border border-purple-800">
            <div className="flex justify-between">
              <span className="text-purple-300">Cliente:</span>
              <span className="font-bold">{completedOrder.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-300">Recebimento:</span>
              <span className="font-bold">{completedOrder.customerAddress}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-300">Itens no pedido:</span>
              <span className="font-bold">{(completedOrder.items || []).length}</span>
            </div>
            <div className="flex justify-between text-base pt-2 border-t border-purple-800">
              <span className="text-purple-200 font-semibold">Total:</span>
              <span className="font-black text-green-400">
                R$ {Number(completedOrder.total).toFixed(2)}
              </span>
            </div>
          </div>

          <button
            onClick={() => handleEnviarWhatsApp(completedOrder)}
            className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg cursor-pointer transition-all"
          >
            <MessageCircle size={24} />
            ENVIAR NO WHATSAPP
          </button>

          <button
            onClick={voltarParaTelaPrincipal}
            className="text-sm text-purple-300 hover:text-white underline cursor-pointer font-semibold"
          >
            ← Voltar ao Cardápio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-purple-950 text-white pb-28 p-4 relative">
      {/* MODAL DE ZOOM DA FOTO DO PRODUTO */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <button className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 cursor-pointer">
            <X size={24} />
          </button>
          <img
            src={zoomImage}
            alt="Foto ampliada"
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Aviso de Loja Fechada */}
      {!settings.is_open && (
        <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-purple-900 border border-purple-700 rounded-3xl max-w-sm w-full p-8 text-center space-y-4 shadow-2xl">
            <Clock size={48} className="text-purple-300 mx-auto" />
            <h2 className="text-2xl font-black uppercase">Fechado no Momento</h2>
            <p className="text-purple-200 text-sm">
              No momento não estamos recebendo pedidos de açaí e sorvete online. Volte em breve!
            </p>
          </div>
        </div>
      )}

      <header className="max-w-md mx-auto text-center mb-6 pt-2">
        <h1 className="text-2xl font-bold">💜🍦 Açaí & Sorvetes Online</h1>
        <p className="text-purple-300 text-sm">
          Monte seu pote no quilo ou escolha nossos copos prontos, casquinhas e milkshakes!
        </p>
      </header>

      <main className="max-w-md mx-auto space-y-5">
        {/* Seletor de Modo: Copos/Sorvetes Prontos (Padrão) vs Montar no Quilo */}
        <div className="grid grid-cols-2 gap-2 bg-purple-900/60 p-1.5 rounded-2xl border border-purple-800">
          <button
            type="button"
            onClick={() => setModoCardapio('copos')}
            className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              modoCardapio === 'copos'
                ? 'bg-purple-600 text-white shadow-lg border border-purple-400'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            <CupSoda size={18} /> Prontos (Copos & Milkshakes)
          </button>
          <button
            type="button"
            onClick={() => setModoCardapio('quilo')}
            className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              modoCardapio === 'quilo'
                ? 'bg-purple-600 text-white shadow-lg border border-purple-400'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            <Scale size={18} /> Montar no Quilo
          </button>
        </div>

        {/* Sacola de Itens adicionados */}
        {sacola.length > 0 && (
          <section className="bg-purple-900/80 p-4 rounded-xl border border-purple-500 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-purple-200 flex items-center gap-2">
                <ShoppingBag size={16} /> Sua Sacola ({sacola.length})
              </h2>
              <span className="text-sm font-bold text-green-400">
                Subtotal: R$ {sacola.reduce((a, b) => a + b.total, 0).toFixed(2)}
              </span>
            </div>
            <div className="space-y-2">
              {sacola.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-purple-950/70 p-3 rounded-lg border border-purple-800 text-sm"
                >
                  <div>
                    <p className="font-bold text-white">
                      #{idx + 1} {item.title} — R$ {item.total.toFixed(2)}
                    </p>
                    {item.flavors?.length > 0 && (
                      <p className="text-xs text-pink-300">
                        Sabores: {item.flavors.join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-purple-300">
                      {item.kind === 'copo_pronto'
                        ? item.description || `${item.size_ml}ml`
                        : item.addons?.length > 0
                        ? item.addons.map((a) => a.name).join(', ')
                        : 'Sem acompanhamentos'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoverDaSacola(item.id)}
                    className="text-red-400 hover:text-red-300 p-1.5 cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* MODO 1: MONTAR NO QUILO (AÇAÍ, SORVETE OU MISTO) */}
        {modoCardapio === 'quilo' && (
          <>
            {/* Escolha da Base: Açaí, Sorvete ou Misto */}
            <section className="bg-purple-900/50 p-4 rounded-xl border border-purple-800">
              <h2 className="text-lg font-semibold mb-3 text-purple-200">
                1. O que você quer no pote?
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoQuilo('acai')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between ${
                    tipoQuilo === 'acai'
                      ? 'bg-purple-600 border-white text-white shadow'
                      : 'bg-purple-900 border-purple-700 text-purple-200 hover:bg-purple-800'
                  }`}
                >
                  {settings.acai_image ? (
                    <img
                      src={settings.acai_image}
                      alt="Açaí"
                      className="w-14 h-14 rounded-xl object-cover mb-1 border border-white/20"
                    />
                  ) : (
                    <span className="text-2xl block">💜</span>
                  )}
                  <span className="text-xs font-bold block mt-1">Só Açaí</span>
                  <span className="text-[10px] text-purple-200">R$ {precoAcaiKg.toFixed(2)}/kg</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoQuilo('sorvete')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between ${
                    tipoQuilo === 'sorvete'
                      ? 'bg-pink-600 border-white text-white shadow'
                      : 'bg-purple-900 border-purple-700 text-purple-200 hover:bg-purple-800'
                  }`}
                >
                  {settings.ice_cream_image ? (
                    <img
                      src={settings.ice_cream_image}
                      alt="Sorvete"
                      className="w-14 h-14 rounded-xl object-cover mb-1 border border-white/20"
                    />
                  ) : (
                    <span className="text-2xl block">🍦</span>
                  )}
                  <span className="text-xs font-bold block mt-1">Só Sorvete</span>
                  <span className="text-[10px] text-purple-200">
                    R$ {precoSorveteKg.toFixed(2)}/kg
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoQuilo('misto')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between ${
                    tipoQuilo === 'misto'
                      ? 'bg-purple-600 border-white text-white shadow'
                      : 'bg-purple-900 border-purple-700 text-purple-200 hover:bg-purple-800'
                  }`}
                >
                  <span className="text-2xl block py-2">💜🍦</span>
                  <span className="text-xs font-bold block mt-1">Açaí + Sorvete</span>
                  <span className="text-[10px] text-purple-200">
                    R$ {Math.max(precoAcaiKg, precoSorveteKg).toFixed(2)}/kg
                  </span>
                </button>
              </div>
            </section>

            {/* Sabores de Sorvete (sempre visíveis para o cliente ver as fotos e escolher) */}
            {saboresSorvete.length > 0 && (
              <section className="bg-purple-900/50 p-4 rounded-xl border border-pink-500/40">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold text-pink-200 flex items-center gap-2">
                    <IceCream size={18} /> Sabores de Sorvete
                  </h2>
                  {saboresSelecionados.length > 0 && (
                    <span className="text-xs font-bold bg-pink-600 text-white px-2.5 py-0.5 rounded-full">
                      {saboresSelecionados.length} selecionado(s)
                    </span>
                  )}
                </div>
                <p className="text-xs text-purple-300 mb-3">
                  {tipoQuilo === 'acai'
                    ? 'Toque em um sabor abaixo se quiser incluir Sorvete no seu pote:'
                    : 'Selecione os sabores de sorvete que deseja no seu pote:'}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {saboresSorvete.map((sabor) => {
                    const selecionado = saboresSelecionados.some((s) => s.id === sabor.id);
                    const esgotado = Boolean(sabor.out_of_stock);
                    return (
                      <div
                        key={sabor.id}
                        onClick={() => !esgotado && handleToggleSabor(sabor)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                          esgotado
                            ? 'bg-purple-950/40 border-purple-900 opacity-40 cursor-not-allowed line-through'
                            : selecionado
                            ? 'bg-pink-600/80 border-white text-white cursor-pointer shadow'
                            : 'bg-purple-900 border-purple-700 text-purple-100 hover:bg-purple-800 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {sabor.image ? (
                            <img
                              src={sabor.image}
                              alt={sabor.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomImage(sabor.image);
                              }}
                              className="w-12 h-12 rounded-lg object-cover shrink-0 border border-white/20 hover:opacity-90"
                            />
                          ) : (
                            <span className="text-xl">🍦</span>
                          )}
                          <span className="truncate">{sabor.name}</span>
                        </div>
                        {selecionado && <span className="text-base font-black shrink-0">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Passo 2: Escolher o Peso em Gramas */}
            <section className="bg-purple-900/50 p-4 rounded-xl border border-purple-800">
              <h2 className="text-lg font-semibold mb-3 text-purple-200">
                2. Escolha a Quantidade (Peso Total)
              </h2>

              <div className="flex items-center justify-between mb-4 bg-purple-950/60 p-3 rounded-xl border border-purple-800">
                <button
                  type="button"
                  onClick={() => alterarGramas(-passoGramas)}
                  disabled={gramas <= minGramas}
                  className="w-10 h-10 rounded-lg bg-purple-800 hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                >
                  <Minus size={18} />
                </button>
                <div className="text-center">
                  <span className="text-xs text-purple-300 block">
                    Peso selecionado (mín. {minGramas}g)
                  </span>
                  <span className="text-2xl font-black text-green-400">
                    {gramas >= 1000
                      ? `${(gramas / 1000).toFixed(2).replace('.00', '')}kg (${gramas}g)`
                      : `${gramas}g`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => alterarGramas(passoGramas)}
                  className="w-10 h-10 rounded-lg bg-purple-800 hover:bg-purple-700 flex items-center justify-center cursor-pointer"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                {opcoesPeso.map((pesoOpcao) => (
                  <button
                    key={pesoOpcao}
                    type="button"
                    onClick={() => setGramas(pesoOpcao)}
                    className={`py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                      gramas === pesoOpcao
                        ? 'bg-purple-600 border-white text-white'
                        : 'bg-purple-900 border-purple-700 text-purple-200 hover:bg-purple-800'
                    }`}
                  >
                    {pesoOpcao >= 1000 ? `${pesoOpcao / 1000}kg` : `${pesoOpcao}g`}
                  </button>
                ))}
              </div>

              <p className="text-xs text-purple-400 text-center">
                Valor proporcional: R$ {precoPorKgAtual.toFixed(2)} o kg (R${' '}
                {((precoPorKgAtual / 1000) * gramas).toFixed(2)} neste pote)
              </p>
            </section>

            {/* Passo 3: Escolher Acompanhamentos / Caldas */}
            <section className="bg-purple-900/50 p-4 rounded-xl border border-purple-800">
              <h2 className="text-lg font-semibold mb-1 text-purple-200">
                3. Escolha os Acompanhamentos & Caldas
              </h2>
              <p className="text-xs text-purple-300 mb-3">
                Os acompanhamentos inclusos são montados junto no pote na balança até atingir os{' '}
                <strong>{gramas}g</strong> escolhidos.
              </p>
              {loadingData ? (
                <p className="text-sm text-purple-300 text-center py-4">
                  Carregando acompanhamentos...
                </p>
              ) : (
                <div className="space-y-2">
                  {adicionais.map((adicional) => {
                    const nome = adicional.name || adicional.nome;
                    const tipo = adicional.type || adicional.tipo || 'incluso';
                    const preco = Number(adicional.price ?? adicional.preco ?? 0);
                    const esgotado = Boolean(adicional.out_of_stock);
                    const selecionado = adicionaisSelecionados.some(
                      (item) => item.id === adicional.id
                    );

                    return (
                      <div
                        key={adicional.id}
                        onClick={() => handleToggleAdicional(adicional)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          esgotado
                            ? 'bg-purple-950/40 border-purple-900 opacity-50 cursor-not-allowed'
                            : selecionado
                            ? 'bg-purple-700/60 border-purple-400 cursor-pointer'
                            : 'bg-purple-900 border-purple-700 hover:bg-purple-800 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {adicional.image && (
                            <img
                              src={adicional.image}
                              alt={nome}
                              className="w-9 h-9 rounded-lg object-cover border border-purple-500/40 shrink-0"
                            />
                          )}
                          <span>{nome}</span>
                          {esgotado && (
                            <span className="text-[10px] uppercase bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-bold">
                              Esgotado
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-purple-300 font-medium">
                          {tipo === 'pago' ? `Extra + R$ ${preco.toFixed(2)}` : 'Incluso no peso'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-purple-800/80">
                <label className="block text-xs text-purple-300 mb-1">
                  Observação deste pote (opcional):
                </label>
                <input
                  type="text"
                  value={observacaoPote}
                  onChange={(e) => setObservacaoPote(e.target.value)}
                  placeholder="Ex: calda no fundo, pouco granulado..."
                  className="w-full bg-purple-950/80 border border-purple-700 rounded-lg px-3 py-2 text-sm text-white placeholder-purple-400 focus:outline-none focus:border-purple-400"
                />
              </div>

              <button
                type="button"
                onClick={handleAdicionarPoteQuiloNaSacola}
                className="mt-3 w-full py-2.5 rounded-lg border border-purple-500/60 bg-purple-800/40 hover:bg-purple-800 text-purple-100 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} /> Adicionar à sacola e montar outro item
              </button>
            </section>
          </>
        )}

        {/* MODO 2: COPOS PRONTOS, CASQUINHAS E MILKSHAKES COM FOTO */}
        {modoCardapio === 'copos' && (
          <section className="bg-purple-900/50 p-4 rounded-xl border border-purple-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-purple-200">
                Copos Prontos & Sorvetes
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'acai', label: '💜 Açaí' },
                { id: 'sorvete', label: '🍦 Sorvetes' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroCopos(f.id)}
                  className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                    filtroCopos === f.id
                      ? 'bg-purple-600 border-white text-white'
                      : 'bg-purple-950 border-purple-800 text-purple-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sabores de Sorvete na aba de Prontos & Casquinhas */}
            {(filtroCopos === 'todos' || filtroCopos === 'sorvete') && saboresSorvete.length > 0 && (
              <div className="bg-purple-950/60 p-3.5 rounded-xl border border-pink-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-pink-200 flex items-center gap-1.5">
                    <IceCream size={15} /> Sabores de Sorvete (Toque para escolher o sabor)
                  </h3>
                  {saboresSelecionados.length > 0 && (
                    <span className="text-[11px] font-bold bg-pink-600 text-white px-2 py-0.5 rounded-full">
                      {saboresSelecionados.map((s) => s.name).join(', ')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {saboresSorvete.map((sabor) => {
                    const selecionado = saboresSelecionados.some((s) => s.id === sabor.id);
                    const esgotado = Boolean(sabor.out_of_stock);
                    return (
                      <div
                        key={sabor.id}
                        onClick={() => !esgotado && handleToggleSabor(sabor)}
                        className={`p-2 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                          esgotado
                            ? 'bg-purple-950/40 border-purple-900 opacity-40 cursor-not-allowed line-through'
                            : selecionado
                            ? 'bg-pink-600/80 border-white text-white cursor-pointer shadow'
                            : 'bg-purple-900 border-purple-700 text-purple-100 hover:bg-purple-800 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {sabor.image ? (
                            <img
                              src={sabor.image}
                              alt={sabor.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomImage(sabor.image);
                              }}
                              className="w-11 h-11 rounded-lg object-cover shrink-0 border border-white/20"
                            />
                          ) : (
                            <span className="text-lg">🍦</span>
                          )}
                          <span className="truncate">{sabor.name}</span>
                        </div>
                        {selecionado && <span className="text-sm font-black shrink-0">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {loadingData ? (
              <p className="text-sm text-purple-300 text-center py-6">Carregando opções...</p>
            ) : coposFiltrados.length === 0 ? (
              <p className="text-sm text-purple-300 text-center py-6">
                Nenhum item disponível nesta categoria.
              </p>
            ) : (
              <div className="space-y-3">
                {coposFiltrados.map((copo) => {
                  const esgotado = Boolean(copo.out_of_stock);
                  const isSorvete = copo.category === 'sorvete';
                  return (
                    <div
                      key={copo.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        esgotado
                          ? 'bg-purple-950/40 border-purple-900 opacity-50'
                          : 'bg-purple-900 border-purple-700 hover:border-purple-500'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {copo.image ? (
                          <img
                            src={copo.image}
                            alt={copo.name}
                            onClick={() => setZoomImage(copo.image)}
                            className="w-20 h-20 rounded-xl object-cover border border-purple-600 shrink-0 cursor-pointer hover:opacity-90"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-purple-950/80 border border-purple-800 flex items-center justify-center text-2xl shrink-0">
                            {isSorvete ? '🍦' : '💜'}
                          </div>
                        )}

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base text-white">
                              {copo.name}
                            </span>
                            {copo.size_ml > 0 && (
                              <span className="text-[11px] bg-purple-700 text-purple-100 px-2 py-0.5 rounded-full font-semibold">
                                {copo.size_ml}ml
                              </span>
                            )}
                            {esgotado && (
                              <span className="text-[10px] uppercase bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-bold">
                                Esgotado
                              </span>
                            )}
                          </div>
                          {copo.description && (
                            <p className="text-xs text-purple-300 leading-relaxed line-clamp-2">
                              {copo.description}
                            </p>
                          )}
                          <p className="text-base font-black text-green-400 pt-0.5">
                            R$ {Number(copo.price || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={esgotado}
                        onClick={() => handleAdicionarCopoPronto(copo)}
                        className="shrink-0 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
                      >
                        <Plus size={16} /> Adicionar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Rodapé Fixo com o Preço Calculado */}
      <footer className="fixed bottom-0 left-0 right-0 bg-purple-900 border-t border-purple-800 p-4 shadow-lg z-20">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs text-purple-300 block">
              {sacola.length > 0
                ? `Total (${sacola.length} ite${sacola.length > 1 ? 'ns' : 'm'} na sacola):`
                : `Total (${getLabelTipoQuilo()} ${gramas}g):`}
            </span>
            <span className="text-xl font-bold text-white">
              R$ {calcularTotalPedido().toFixed(2)}
            </span>
          </div>
          <button
            onClick={handleAbrirCheckout}
            className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-bold transition-all cursor-pointer"
          >
            Avançar / Finalizar
          </button>
        </div>
      </footer>

      {/* MODAL DE FINALIZAÇÃO DO PEDIDO */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-purple-950 border border-purple-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-purple-800 pb-3">
              <h3 className="text-lg font-bold">Finalizar Pedido</h3>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-purple-300 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFinalizarPedido} className="space-y-4">
              <div className="bg-purple-900/50 p-3 rounded-xl border border-purple-800 space-y-2 max-h-40 overflow-y-auto">
                {sacola.map((item, i) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-xs border-b border-purple-800/50 pb-1 last:border-none"
                  >
                    <span>
                      <strong>#{i + 1}:</strong> {item.title}
                      {item.flavors?.length > 0 && ` [Sabores: ${item.flavors.join(', ')}]`}
                      {item.addons?.length > 0 && ` (${item.addons.map((a) => a.name).join(', ')})`}
                    </span>
                    <span className="font-bold text-green-400">R$ {item.total.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-1">
                  <span>Total a Pagar:</span>
                  <span className="text-green-400">R$ {calcularTotalPedido().toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-purple-300 mb-1 flex items-center gap-1">
                  <User size={13} /> Seu Nome *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Digite seu nome"
                  className="w-full bg-purple-900 border border-purple-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-purple-400"
                />
              </div>

              <div>
                <label className="text-xs text-purple-300 mb-1 flex items-center gap-1">
                  <Phone size={13} /> WhatsApp / Telefone
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(00) 90000-0000"
                  className="w-full bg-purple-900 border border-purple-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType('entrega')}
                  className={`py-2 rounded-lg border text-xs font-bold uppercase cursor-pointer ${
                    deliveryType === 'entrega'
                      ? 'bg-purple-600 border-white text-white'
                      : 'bg-purple-900 border-purple-700 text-purple-300'
                  }`}
                >
                  🛵 Entrega
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType('retirada')}
                  className={`py-2 rounded-lg border text-xs font-bold uppercase cursor-pointer ${
                    deliveryType === 'retirada'
                      ? 'bg-purple-600 border-white text-white'
                      : 'bg-purple-900 border-purple-700 text-purple-300'
                  }`}
                >
                  🏪 Retirar no Local
                </button>
              </div>

              {deliveryType === 'entrega' && (
                <div>
                  <label className="text-xs text-purple-300 mb-1 flex items-center gap-1">
                    <MapPin size={13} /> Endereço Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Rua, Número, Bairro, Ponto de referência"
                    className="w-full bg-purple-900 border border-purple-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-purple-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-purple-300 mb-1">Forma de Pagamento *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pix', label: 'PIX' },
                    { id: 'cartao', label: 'Cartão' },
                    { id: 'dinheiro', label: 'Dinheiro' }
                  ].map((metodo) => (
                    <button
                      key={metodo.id}
                      type="button"
                      onClick={() => setPaymentMethod(metodo.id)}
                      className={`py-2.5 rounded-lg border text-xs font-bold cursor-pointer ${
                        paymentMethod === metodo.id
                          ? 'bg-purple-600 border-white text-white'
                          : 'bg-purple-900 border-purple-700 text-purple-200'
                      }`}
                    >
                      {metodo.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'dinheiro' && (
                <div>
                  <label className="block text-xs text-purple-300 mb-1">
                    Precisa de troco para quanto?
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={changeAmount}
                    onChange={(e) => setChangeAmount(e.target.value)}
                    placeholder="Deixe em branco se não precisar"
                    className="w-full bg-purple-900 border border-purple-700 rounded-lg px-3 py-2 text-sm text-white placeholder-purple-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-purple-300 mb-1">
                  Observação da Entrega (opcional)
                </label>
                <input
                  type="text"
                  value={generalObservation}
                  onChange={(e) => setGeneralObservation(e.target.value)}
                  placeholder="Ex: interfone quebrado, chamar no portão..."
                  className="w-full bg-purple-900 border border-purple-700 rounded-lg px-3 py-2 text-sm text-white placeholder-purple-400"
                />
              </div>

              <button
                type="submit"
                disabled={savingOrder}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-base shadow-lg cursor-pointer transition-all"
              >
                {savingOrder
                  ? 'Salvando Pedido...'
                  : `Confirmar Pedido (R$ ${calcularTotalPedido().toFixed(2)})`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

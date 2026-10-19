import React, { useState } from 'react';

export default function OnlineAcaiMenu() {
  // Preço do Açaí por Quilo (ex: R$ 60,00 o kg -> R$ 0,06 por grama)
  const precoPorKg = 60.00;
  
  // Peso mínimo permitido (ex: 300g) e o peso atual escolhido pelo cliente
  const [gramas, setGramas] = useState(300);
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState([]);

  // Lista de adicionais (como vimos antes)
  const adicionais = [
    { id: 1, nome: 'Leite Condensado', tipo: 'incluso', preco: 0 },
    { id: 2, nome: 'Leite em Pó (Ninho)', tipo: 'pago', preco: 3.00 },
    { id: 3, nome: 'Paçoca', tipo: 'incluso', preco: 0 },
    { id: 4, nome: 'Morango', tipo: 'pago', preco: 4.00 },
  ];

  const handleToggleAdicional = (adicional) => {
    if (adicionaisSelecionados.some((item) => item.id === adicional.id)) {
      setAdicionaisSelecionados(adicionaisSelecionados.filter((item) => item.id !== adicional.id));
    } else {
      setAdicionaisSelecionados([...adicionaisSelecionados, adicional]);
    }
  };

  // Cálculo dinâmico: (Preço por Quilo / 1000) * Gramas escolhidas + Adicionais
  const calcularTotal = () => {
    const precoAçai = (precoPorKg / 1000) * gramas;
    let totalAdicionais = 0;
    adicionaisSelecionados.forEach((item) => {
      totalAdicionais += item.preco || 0;
    });
    return (precoAçai + totalAdicionais).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-purple-950 text-white pb-24 p-4">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold">💜 Açaí no Quilo Online</h1>
        <p className="text-purple-300 text-sm">Monte o seu pote escolhendo o peso e os complementos!</p>
      </header>

      <main className="max-w-md mx-auto space-y-6">
        {/* Passo 1: Escolher o Peso em Gramas (Mínimo 300g) */}
        <section className="bg-purple-900/50 p-4 rounded-xl border border-purple-800">
          <h2 className="text-lg font-semibold mb-3 text-purple-200">1. Escolha a Quantidade (Peso)</h2>
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-purple-300">Peso selecionado:</span>
            <span className="text-xl font-bold text-green-400">{gramas}g</span>
          </div>

          {/* Botões rápidos de incremento/decremento ou opções padrão */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[300, 400, 500, 1000].map((pesoOpcao) => (
              <button
                key={pesoOpcao}
                onClick={() => setGramas(pesoOpcao)}
                className={`py-2 rounded-lg border text-sm font-semibold transition-all ${
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
            Valor proporcional: R$ {precoPorKg.toFixed(2)} o kg
          </p>
        </section>

        {/* Passo 2: Escolher Adicionais */}
        <section className="bg-purple-900/50 p-4 rounded-xl border border-purple-800">
          <h2 className="text-lg font-semibold mb-3 text-purple-200">2. Escolha os Adicionais</h2>
          <div className="space-y-2">
            {adicionais.map((adicional) => {
              const selecionado = adicionaisSelecionados.some((item) => item.id === adicional.id);
              return (
                <div
                  key={adicional.id}
                  onClick={() => handleToggleAdicional(adicional)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    selecionado
                      ? 'bg-purple-700/60 border-purple-400'
                      : 'bg-purple-900 border-purple-700 hover:bg-purple-800'
                  }`}
                >
                  <span>{adicional.nome}</span>
                  <span className="text-sm text-purple-300">
                    {adicional.tipo === 'pago' ? `+ R$ ${adicional.preco.toFixed(2)}` : 'Incluso'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Rodapé Fixo com o Preço Calculado */}
      <footer className="fixed bottom-0 left-0 right-0 bg-purple-900 border-t border-purple-800 p-4 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs text-purple-300 block">Total ({gramas}g + adicionais):</span>
            <span className="text-xl font-bold text-white">R$ {calcularTotal()}</span>
          </div>
          <button
            onClick={() => alert(`Pedido de ${gramas}g simulado com sucesso!`)}
            className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-bold transition-all cursor-pointer"
          >
            Avançar / Finalizar
          </button>
        </div>
      </footer>
    </div>
  );
}
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom" // Import useNavigate
import { categories } from "../data/menu"
import { productService, configService } from "../services/api"
import { CategoryButton } from "../components/CategoryButton"
import { ProductCard } from "../components/ProductCard"
import { Cart } from "../components/Cart"
import Logo from "../assets/herosburger.jpg"
import { useCart } from "../context/CartContext"


export default function Menu() {
  const [selectedCategory, setSelectedCategory] = useState("burgers")
  const [products, setProducts] = useState([])
  const [settingsHours, setSettingsHours] = useState("18:00 — 00:00")
  const [time, setTime] = useState(new Date())
  const navigate = useNavigate()
  const { hfPizza, hfSize, cancelHalfPizza } = useCart()

  useEffect(() => {
    productService.getProducts().then(setProducts)

    configService.getSettings().then(data => {
      const hoursConfig = data.find(c => c.key === 'hours')
      if (hoursConfig) setSettingsHours(hoursConfig.value)
    })

    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const filteredProducts = products.filter(
    (p) => p.category === selectedCategory
  )

  return (
    <div className="h-screen w-screen flex bg-gradient-to-br from-orange-500 to-red-600 overflow-hidden relative">
      {/* AVISO SELEÇÃO SEGUNDO SABOR (TOTEM) */}
      {hfPizza && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-400 text-gray-900 p-6 z-50 flex justify-between items-center shadow-2xl animate-pulse">
          <span className="text-3xl font-black uppercase">🍕 Escolha o 2º Sabor para sua Pizza {hfSize}</span>
          <button
            onClick={cancelHalfPizza}
            className="bg-black text-white px-8 py-3 rounded-full font-black text-xl shadow-lg"
          >
            CANCELAR
          </button>
        </div>
      )}

      {/* COLUNA 1 — CATEGORIAS (Scrollavel se houver muitas) */}
      <aside className="w-1/5 h-full p-6 z-10 flex flex-col items-center overflow-y-auto scrollbar-hide space-y-4">
        {/* BLOCO DE INFORMAÇÕES: RELÓGIO + FUNCIONAMENTO */}
        <div className="w-full bg-white/10 backdrop-blur-md rounded-[32px] p-6 mb-4 border border-white/10 shadow-2xl shrink-0">
          <div className="text-white text-5xl font-black drop-shadow-lg tracking-tighter leading-none mb-2 text-center">
            {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="h-[2px] w-12 bg-yellow-400 mx-auto mb-3 rounded-full"></div>
          <div className="text-white font-bold text-[10px] uppercase tracking-[0.2em] text-center">
            Horário de Funcionamento
          </div>
          <div className="text-green-400 text-lg font-black mt-1 text-center">
            {settingsHours}
          </div>
        </div>

        {/* LOGO NO MENU (Clicável para Home) */}
        <div
          onClick={() => navigate("/")}
          className="mb-6 flex justify-center opacity-60 mix-blend-overlay hover:opacity-100 hover:scale-105 transition-all duration-300 cursor-pointer shrink-0"
          title="Voltar para o Início"
        >
          <img
            src={Logo}
            alt="Logo Menu"
            className="w-40 h-40 rounded-full border-4 border-white/50 shadow-2xl"
          />
        </div>

        <div className="w-full space-y-4 pb-10">
          {categories.map((cat) => (
            <CategoryButton
              key={cat.id}
              text={cat.name}
              active={cat.id === selectedCategory}
              onClick={() => setSelectedCategory(cat.id)}
            />
          ))}
        </div>
      </aside>

      {/* COLUNA 2 — PRODUTOS (Auto-ajustável e Inteligente) */}
      <main className="w-3/5 h-full overflow-y-auto scrollbar-hide p-6">
        <div className="grid grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-8 pb-40 max-w-[1800px] mx-auto">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-white opacity-40">
            <span className="text-9xl mb-4">🍕</span>
            <p className="text-3xl font-black uppercase tracking-widest">Nenhum item nesta categoria</p>
          </div>
        )}
      </main>

      {/* COLUNA 3 — CARRINHO */}
      <Cart />

    </div>
  )


}
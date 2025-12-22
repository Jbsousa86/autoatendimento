import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom" // Import useNavigate
import { categories } from "../data/menu"
import { productService } from "../services/api"
import { CategoryButton } from "../components/CategoryButton"
import { ProductCard } from "../components/ProductCard"
import { Cart } from "../components/Cart"
import Logo from "../assets/herosburger.jpg" // Importando Logo for Menu


export default function Menu() {
  const [selectedCategory, setSelectedCategory] = useState("burgers")
  const [products, setProducts] = useState([])
  const navigate = useNavigate() // Init hook

  useEffect(() => {
    productService.getProducts().then(setProducts)
  }, [])

  const filteredProducts = products.filter(
    (p) => p.category === selectedCategory
  )

  return (
    <div className="h-screen w-screen flex bg-gradient-to-br from-orange-500 to-red-600 overflow-hidden">

      {/* COLUNA 1 — CATEGORIAS (Flutuantes) */}
      <aside className="w-1/5 p-6 z-10 flex flex-col justify-center space-y-4">
        {/* LOGO NO MENU (Clicável para Home) */}
        <div
          onClick={() => navigate("/")}
          className="mb-6 flex justify-center opacity-60 mix-blend-overlay hover:opacity-100 hover:scale-105 transition-all duration-300 cursor-pointer"
          title="Voltar para o Início"
        >
          <img
            src={Logo}
            alt="Logo Menu"
            className="w-40 h-40 rounded-full border-4 border-white/50 shadow-2xl"
          />
        </div>

        {categories.map((cat) => (
          <CategoryButton
            key={cat.id}
            text={cat.name}
            active={cat.id === selectedCategory}
            onClick={() => setSelectedCategory(cat.id)}
          />
        ))}
      </aside>

      {/* COLUNA 2 — PRODUTOS (Scrollavel e Otimizada para Totem) */}
      <main className="w-3/5 h-full overflow-y-auto scrollbar-hide p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-40 max-w-[1600px] mx-auto">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>

      {/* COLUNA 3 — CARRINHO */}
      <Cart />

    </div>
  )


}
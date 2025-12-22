import { useState, useEffect } from "react"
import { categories } from "../data/menu"
import { productService } from "../services/api"
import { CategoryButton } from "../components/CategoryButton"
import { ProductCard } from "../components/ProductCard"
import { Cart } from "../components/Cart"
import Logo from "../assets/herosburger.jpg" // Importando Logo for Menu


export default function Menu() {
  const [selectedCategory, setSelectedCategory] = useState("burgers")
  const [products, setProducts] = useState([])

  useEffect(() => {
    productService.getProducts().then(setProducts)
  }, [])

  const filteredProducts = products.filter(
    (p) => p.category === selectedCategory
  )

  return (
    <div className="h-screen w-screen flex bg-gradient-to-br from-orange-500 to-red-600">

      {/* COLUNA 1 — CATEGORIAS (Flutuantes) */}
      <aside className="w-1/5 p-6 z-10 flex flex-col justify-center space-y-4">
        {/* LOGO NO MENU (Estilo Watermark/Opaco) */}
        <div className="mb-6 flex justify-center opacity-40 mix-blend-overlay hover:opacity-80 transition-opacity duration-500">
          <img
            src={Logo}
            alt="Logo Menu"
            className="w-40 h-40 rounded-full border-4 border-white/30 shadow-2xl"
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

      {/* COLUNA 2 — PRODUTOS */}
      <main className="w-3/5 p-10">
        <div className="grid grid-cols-2 gap-10">
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
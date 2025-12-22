import { useState, useEffect } from "react"
import { categories } from "../data/menu"
import { productService } from "../services/api"
import { CategoryButton } from "../components/CategoryButton"
import { ProductCard } from "../components/ProductCard"
import { Cart } from "../components/Cart"


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
    <div className="h-screen w-screen flex bg-gray-100">

      {/* COLUNA 1 — CATEGORIAS */}
      <aside className="w-1/5 bg-white p-6 border-r">
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
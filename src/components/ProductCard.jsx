import { useCart } from "../context/CartContext"

export function ProductCard({ product }) {
  const { addToCart } = useCart()

  return (
    <div className="bg-white/20 backdrop-blur-lg border border-white/30 rounded-3xl p-6 shadow-2xl flex flex-col h-full hover:bg-white/30 transition-all duration-300">
      {product.image && (
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-48 object-cover rounded-2xl mb-6 shadow-md"
        />
      )}

      <h3 className="text-3xl font-black mb-2 leading-none text-white drop-shadow-md">
        {product.name}
      </h3>

      <p className="text-4xl font-black text-yellow-300 mb-2 drop-shadow-sm">
        R$ {Number(product.price).toFixed(2)}
      </p>

      <p className="text-white/90 text-lg mb-8 leading-snug font-medium">
        {product.description}
      </p>

      {!['pizzas', 'pizza'].includes(product.category.toLowerCase()) ? (
        <button
          onClick={() => addToCart(product)}
          className="mt-auto h-16 bg-white text-orange-600 text-2xl font-black rounded-2xl shadow-lg hover:bg-orange-50 hover:scale-[1.02] active:scale-95 transition-all w-full"
        >
          ADICIONAR
        </button>
      ) : (
        <div className="mt-auto grid grid-cols-3 gap-2">
          {/* BOTÃO P */}
          <button
            onClick={() => addToCart({
              ...product,
              id: `${product.id}-P`,
              name: `${product.name} (P)`,
              price: product.price_p || (product.price * 0.8)
            })}
            className="h-16 bg-white text-orange-600 text-xl font-black rounded-xl shadow hover:bg-orange-50 active:scale-95 transition-all flex flex-col items-center justify-center leading-none"
          >
            <span>P</span>
            <span className="text-xs opacity-70">
              R${Number(product.price_p || product.price * 0.8).toFixed(0)}
            </span>
          </button>

          {/* BOTÃO M */}
          <button
            onClick={() => addToCart({
              ...product,
              id: `${product.id}-M`,
              name: `${product.name} (M)`,
              price: product.price
            })}
            className="h-16 bg-orange-600 text-white text-2xl font-black rounded-xl shadow-lg hover:bg-orange-500 active:scale-95 transition-all flex flex-col items-center justify-center leading-none transform scale-105 z-10"
          >
            <span>M</span>
            <span className="text-xs opacity-80">
              R${Number(product.price).toFixed(0)}
            </span>
          </button>

          {/* BOTÃO G */}
          <button
            onClick={() => addToCart({
              ...product,
              id: `${product.id}-G`,
              name: `${product.name} (G)`,
              price: product.price_g || (product.price * 1.2)
            })}
            className="h-16 bg-white text-orange-600 text-xl font-black rounded-xl shadow hover:bg-orange-50 active:scale-95 transition-all flex flex-col items-center justify-center leading-none"
          >
            <span>G</span>
            <span className="text-xs opacity-70">
              R${Number(product.price_g || product.price * 1.2).toFixed(0)}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

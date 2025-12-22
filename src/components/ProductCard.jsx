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

      <button
        onClick={() => addToCart(product)}
        className="mt-auto h-16 bg-white text-orange-600 text-2xl font-black rounded-2xl shadow-lg hover:bg-orange-50 hover:scale-[1.02] active:scale-95 transition-all"
      >
        ADICIONAR
      </button>
    </div>
  )
}

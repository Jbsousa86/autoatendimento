import { useCart } from "../context/CartContext"

export function ProductCard({ product }) {
  const { addToCart } = useCart()

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg flex flex-col h-full">
      {product.image && (
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-48 object-cover rounded-xl mb-6"
        />
      )}

      <h3 className="text-3xl font-extrabold mb-4 leading-none">
        {product.name}
      </h3>

      <p className="text-4xl font-black text-green-600 mb-2">
        R$ {Number(product.price).toFixed(2)}
      </p>

      <p className="text-gray-500 text-lg mb-8 leading-snug">
        {product.description}
      </p>

      <button
        onClick={() => addToCart(product)}
        className="mt-auto h-16 bg-red-600 text-white text-2xl font-bold rounded-2xl"
      >
        ADICIONAR
      </button>
    </div>
  )
}

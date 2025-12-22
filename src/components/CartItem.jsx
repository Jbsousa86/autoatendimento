import { useCart } from "../context/CartContext"

export function CartItem({ item }) {
  const { increase, decrease } = useCart()

  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <p className="text-xl font-bold">{item.name}</p>
        <p className="text-xl text-black font-bold">
          R$ {item.price} | Qtd: {item.qty}
        </p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => decrease(item.id)}
          className="w-12 h-12 bg-gray-300 text-2xl rounded-xl"
        >
          −
        </button>

        <button
          onClick={() => increase(item.id)}
          className="w-12 h-12 bg-red-600 text-white text-2xl rounded-xl"
        >
          +
        </button>
      </div>
    </div>
  )
}

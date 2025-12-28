import { useCart } from "../context/CartContext"

export function ProductCard({ product }) {
  const { addToCart, startHalfPizza, hfPizza, hfSize } = useCart()

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
          {/* SE ESTIVER NO MEIO-A-MEIO, QUALQUER BOTÃO ADICIONA O SABOR */}
          {hfPizza ? (
            <button
              onClick={() => addToCart(product)}
              className="col-span-3 h-20 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xl font-black rounded-2xl shadow-xl animate-pulse flex items-center justify-center gap-2 border-b-4 border-orange-700"
            >
              <span>🍕</span> SABOR 2 (TAMANHO {hfSize})
            </button>
          ) : (
            <>
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
                <span className="text-[10px] opacity-70">
                  R${Number(product.price_p || product.price * 0.8).toFixed(0)}
                </span>
              </button>

              {/* BOTÃO M */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => addToCart({
                    ...product,
                    id: `${product.id}-M`,
                    name: `${product.name} (M)`,
                    price: product.price,
                    category: 'pizzas'
                  })}
                  className="h-16 bg-orange-600 text-white text-2xl font-black rounded-2xl shadow-lg hover:bg-orange-500 active:scale-95 transition-all flex flex-col items-center justify-center leading-none border-2 border-orange-400"
                >
                  <span>M</span>
                  <span className="text-xs font-bold opacity-90">R${Number(product.price).toFixed(0)}</span>
                </button>
                <button
                  onClick={() => startHalfPizza(product, 'M')}
                  className="py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[11px] font-black rounded-xl hover:scale-105 active:scale-95 transition-all uppercase shadow-md flex items-center justify-center gap-1 border-b-4 border-orange-700"
                >
                  <span className="text-lg">🌓</span> 1/2
                </button>
              </div>

              {/* BOTÃO G */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => addToCart({
                    ...product,
                    id: `${product.id}-G`,
                    name: `${product.name} (G)`,
                    price: product.price_g || (product.price * 1.2),
                    category: 'pizzas'
                  })}
                  className="h-16 bg-white text-orange-600 text-2xl font-black rounded-2xl shadow-lg hover:bg-orange-50 active:scale-95 transition-all flex flex-col items-center justify-center leading-none border-2 border-orange-200"
                >
                  <span>G</span>
                  <span className="text-xs font-bold opacity-70">R${Number(product.price_g || product.price * 1.2).toFixed(0)}</span>
                </button>
                <button
                  onClick={() => startHalfPizza(product, 'G')}
                  className="py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[11px] font-black rounded-xl hover:scale-105 active:scale-95 transition-all uppercase shadow-md flex items-center justify-center gap-1 border-b-4 border-orange-700"
                >
                  <span className="text-lg">🌓</span> 1/2
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

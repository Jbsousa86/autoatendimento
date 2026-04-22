import { useCart } from "../context/useCart"

export function ProductCard({ product }) {
  const { addToCart, startHalfPizza, hfPizza, hfSize } = useCart()

  return (
    <div className={`bg-white/20 backdrop-blur-lg border border-white/30 rounded-3xl p-6 shadow-2xl flex flex-col h-full transition-all duration-300 relative ${product.out_of_stock ? 'grayscale opacity-60 pointer-events-none' : 'hover:bg-white/30'}`}>
      {product.out_of_stock && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-red-600 text-white px-6 py-2 rounded-xl font-black text-2xl tracking-widest shadow-2xl -rotate-12 border-4 border-red-800 flex items-center justify-center whitespace-nowrap">
          ESGOTADO
        </div>
      )}
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

      <div className="flex flex-col mb-2">
        {product.old_price && (
          <span className="text-xl text-white/60 line-through leading-none mb-1 font-bold">
            R$ {Number(product.old_price).toFixed(2)}
          </span>
        )}
        <p className="text-4xl font-black text-yellow-300 drop-shadow-sm leading-none">
          R$ {Number(product.price).toFixed(2)}
        </p>
      </div>

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

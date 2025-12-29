import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import Logo from "../assets/herosburger.jpg"

const BACKGROUND_IMAGES = [
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1998&auto=format&fit=crop", // Burger
  "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=2070&auto=format&fit=crop", // Bebidas (Refri/Suco)
  "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?q=80&w=2070&auto=format&fit=crop", // Pizza
  "https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=1965&auto=format&fit=crop"  // Combo
]

export default function Start() {
  const navigate = useNavigate()
  const [currentImg, setCurrentImg] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImg((prev) => (prev + 1) % BACKGROUND_IMAGES.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center text-white relative overflow-hidden bg-gray-900">
      {/* BACKGROUND SLIDESHOW */}
      {BACKGROUND_IMAGES.map((img, idx) => (
        <div
          key={img}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out`}
          style={{
            backgroundImage: `url('${img}')`,
            opacity: currentImg === idx ? 0.4 : 0
          }}
        />
      ))}

      {/* Dark Overlay for better contrast */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Conteúdo ORIGINAL */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in-up">
        <img
          src={Logo}
          alt="Logo Hero's Burger"
          className="w-64 h-64 object-contain mb-8 rounded-full shadow-2xl border-4 border-white/10"
        />

        <p className="text-2xl mb-12 text-gray-200 uppercase tracking-widest font-bold text-center">
          O melhor sabor da cidade
        </p>

        <button
          onClick={() => navigate("/menu")}
          className="w-96 py-8 bg-green-600 hover:bg-green-500 text-white text-3xl font-black rounded-full shadow-2xl transition-transform hover:scale-105 active:scale-95 border-4 border-white/20 animate-pulse"
        >
          FAZER PEDIDO
        </button>
      </div>
    </div>
  )
}

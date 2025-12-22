import { useNavigate } from "react-router-dom"
import Logo from "../assets/herosburger.jpg" // Importando a logo

export default function Start() {
  const navigate = useNavigate()

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center text-white bg-cover bg-center"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=1965&auto=format&fit=crop')"
      }}
    >
      {/* Overlay escuro para melhorar leitura */}
      <div className="absolute inset-0 bg-black/60"></div>

      {/* Conteúdo (Z-Index para ficar por cima da imagem) */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in-up">
        {/* LOGO DA MARCA */}
        <img
          src={Logo}
          alt="Logo Hero's Burger"
          className="w-64 h-64 object-contain mb-8 rounded-full shadow-2xl border-4 border-white/10"
        />

        <p className="text-2xl mb-12 text-gray-200 uppercase tracking-widest font-bold">
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

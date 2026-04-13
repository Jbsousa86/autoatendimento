import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { configService } from "../services/api"
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
  const [backgroundImages, setBackgroundImages] = useState(BACKGROUND_IMAGES)
  const [startVideo, setStartVideo] = useState("")

  useEffect(() => {
    configService.getSettings().then(data => {
      const startBannerConfig = data.find(c => c.key === 'start_banner')
      if (startBannerConfig) {
        try {
          const parsed = JSON.parse(startBannerConfig.value)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBackgroundImages(parsed)
          }
        } catch (e) {}
      }

      const startVideoConfig = data.find(c => c.key === 'start_video')
      if (startVideoConfig && startVideoConfig.value) {
        setStartVideo(startVideoConfig.value)
      }
    })
  }, [])

  useEffect(() => {
    if (backgroundImages.length <= 1) return; // Não faz animação se tiver só 1 imagem
    const timer = setInterval(() => {
      setCurrentImg((prev) => (prev + 1) % backgroundImages.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [backgroundImages.length])

  return (
    <div 
      onClick={() => navigate("/menu")}
      className="h-screen w-screen flex flex-col items-center justify-end pb-16 text-white relative overflow-hidden bg-gray-900 cursor-pointer select-none"
    >
      {/* BACKGROUND VIDEO OU SLIDESHOW */}
      {startVideo ? (
        <video
          src={startVideo}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-100 transition-opacity duration-1000"
        />
      ) : (
        backgroundImages.map((img, idx) => (
          <div
            key={img}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out`}
            style={{
              backgroundImage: `url('${img}')`,
              opacity: currentImg === idx ? 1 : 0
            }}
          />
        ))
      )}

      {/* Gradient Overlay: Escuro em baixo para ler os textos, topo 100% transparente */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>

      {/* LOGO E SLOGAN (SUPERIOR DIREITO) */}
      <div className="absolute top-8 right-8 md:top-12 md:right-12 z-20 flex flex-col items-end group">
        <img
          src={Logo}
          alt="Logo Hero's Burger"
          className="w-24 h-24 md:w-28 md:h-28 object-contain mb-3 rounded-full shadow-2xl border-2 border-white/20 opacity-60 group-hover:opacity-100 transition-opacity duration-300"
        />
        <p className="text-[10px] md:text-xs text-white uppercase tracking-widest font-bold text-right drop-shadow-lg opacity-60 group-hover:opacity-100 transition-opacity duration-300">
          O melhor sabor da cidade
        </p>
      </div>

      {/* INSTRUÇÃO DE TOQUE (RODAPÉ) */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in-up">
        <div className="mt-4 flex flex-col items-center">
          <span className="text-3xl md:text-4xl font-light tracking-widest uppercase text-white/90 mb-1 drop-shadow-md">
            Toque na Tela
          </span>
          <span className="text-xs md:text-sm font-medium tracking-[0.3em] uppercase text-white/50 drop-shadow-md">
            Para iniciar seu pedido
          </span>
        </div>
      </div>
    </div>
  )
}

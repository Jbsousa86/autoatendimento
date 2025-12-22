import { useNavigate } from "react-router-dom"

export default function Start() {
  const navigate = useNavigate()

  return (
    <div className="h-screen w-screen bg-orange-600 flex flex-col items-center justify-center text-white">
      <h1 className="text-6xl font-extrabold mb-16">
        🍔 Lanchonete
      </h1>

      <button
        onClick={() => navigate("/menu")}
        className="w-96 h-28 bg-white text-red-600 text-3xl font-bold rounded-3xl"
      >
        TOQUE PARA COMEÇAR
      </button>
    </div>
  )
}


export function CategoryButton({ text, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full h-24 mb-6 rounded-2xl text-xl font-black transition-all duration-300 shadow-lg backdrop-blur-md border border-white/10
        ${active
          ? "bg-white text-orange-600 scale-110 shadow-orange-900/40 z-20 border-white"
          : "bg-black/20 text-white hover:bg-black/30 hover:scale-105 hover:shadow-xl"}
      `}
    >
      {text}
    </button>
  )
}

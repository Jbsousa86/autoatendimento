export function CategoryButton({ text, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full min-h-[4.5rem] xl:h-24 px-2 py-2 rounded-2xl text-xs md:text-sm lg:text-base xl:text-xl font-black leading-tight break-words flex items-center justify-center text-center transition-all duration-300 shadow-lg backdrop-blur-md border border-white/10
        ${active
          ? "bg-white text-orange-600 scale-[1.03] xl:scale-105 shadow-orange-900/40 z-20 border-white"
          : "bg-black/20 text-white hover:bg-black/30 hover:scale-[1.02] hover:shadow-xl"}
      `}
    >
      <span className="w-full break-words">{text}</span>
    </button>
  )
}

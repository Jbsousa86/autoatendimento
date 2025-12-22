export function CategoryButton({ text, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full h-24 mb-6 rounded-3xl text-2xl font-bold transition
        ${active 
          ? "bg-red-600 text-white shadow-lg scale-105" 
          : "bg-gray-200 text-gray-800"}
      `}
    >
      {text}
    </button>
  )
}


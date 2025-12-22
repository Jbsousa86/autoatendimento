import { Routes, Route } from "react-router-dom"
import Start from "./pages/Start"
import Menu from "./pages/Menu"
import Finish from "./pages/Finish"
import Kitchen from "./pages/Kitchen"
import Admin from "./pages/Admin"


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/menu" element={<Menu />} />
      <Route path="/finish" element={<Finish />} />
      <Route path="/kitchen" element={<Kitchen />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}

import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import FinderMode from "./pages/FinderMode.jsx";
import SeekerMode from "./pages/SeekerMode.jsx";
import Navbar from "./components/Navbar.jsx";

export default function App() {
  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gefunden" element={<FinderMode />} />
          <Route path="/verloren" element={<SeekerMode />} />
        </Routes>
      </main>
    </div>
  );
}

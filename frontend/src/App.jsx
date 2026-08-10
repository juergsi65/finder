import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import FinderMode from "./pages/FinderMode.jsx";
import SeekerMode from "./pages/SeekerMode.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Profile from "./pages/Profile.jsx";
import Admin from "./pages/Admin.jsx";
import Navbar from "./components/Navbar.jsx";
import Spinner from "./components/Spinner.jsx";
import { useAuth } from "./AuthContext.jsx";

function FullscreenSpinner() {
  return (
    <div className="h-full flex items-center justify-center">
      <Spinner className="w-8 h-8 text-trail-600" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullscreenSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gefunden" element={<FinderMode />} />
          <Route path="/verloren" element={<SeekerMode />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registrieren" element={<Register />} />
          <Route
            path="/profil"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

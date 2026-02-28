import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AuthModal from "./components/AuthModal";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Blend from "./pages/Blend";
import HostCreate from "./pages/HostCreate";
import HostConstraints from "./pages/HostConstraints";
import HostLobby from "./pages/HostLobby";
import HostLive from "./pages/HostLive";
import HostBlend from "./pages/HostBlend";
import MobileJoin from "./pages/MobileJoin";
import MobileSwipe from "./pages/MobileSwipe";

export default function App() {
  return (
    <AuthProvider
      renderModal={(open, onClose) => (
        <AuthModal open={open} onClose={onClose} />
      )}
    >
      <Routes>
        <Route path="/"                   element={<Home />} />
        <Route path="/blend"              element={<Blend />} />
        <Route path="/session"            element={<Landing />} />
        <Route path="/host/create"        element={<HostCreate />} />
        <Route path="/host/constraints"   element={<HostConstraints />} />
        <Route path="/host/lobby"         element={<HostLobby />} />
        <Route path="/host/live"          element={<HostLive />} />
        <Route path="/host/blend"         element={<HostBlend />} />
        <Route path="/m/:code"            element={<MobileJoin />} />
        <Route path="/m/:code/swipe"      element={<MobileSwipe />} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

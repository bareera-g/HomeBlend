import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import AuthPage  from "./components/AuthPage.jsx";
import Dashboard from "./components/Dashboard.jsx";
import RoomView  from "./components/RoomView.jsx";
import { B } from "./Brand.jsx";

function ProtectedRoute({ element }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height: "100dvh", background: B.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid rgba(166,124,61,0.2)`, borderTopColor: B.gold, animation: "spin 0.7s linear infinite" }} />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return element;
}

const router = createBrowserRouter([
  { path: "/auth",           element: <AuthPage /> },
  { path: "/dashboard",      element: <ProtectedRoute element={<Dashboard />} /> },
  { path: "/room/:roomCode", element: <ProtectedRoute element={<RoomView />} /> },
  { path: "/",               element: <Navigate to="/dashboard" replace /> },
  { path: "*",               element: <Navigate to="/dashboard" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

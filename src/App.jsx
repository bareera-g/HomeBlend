import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import AuthPage  from "./components/AuthPage.jsx";
import Dashboard from "./components/Dashboard.jsx";
import RoomView  from "./components/RoomView.jsx";
import { B } from "./Brand.jsx";
import LoadingBar from "./components/LoadingBar.jsx";

function ProtectedRoute({ element }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height: "100dvh", background: B.bg }}>
      <LoadingBar loading={true} />
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

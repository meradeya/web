import { Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { ListingDetail } from "./pages/ListingDetail";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { AuthProvider } from "./AuthContext";

/**
 * A generic placeholder component for routes that are not yet implemented.
 *
 * @param props - Component properties
 * @param props.title - The title to display on the stub page
 */
const StubPage = ({ title }: { title: string }) => (
  <div className="main-content container flex items-center justify-center">
    <div className="empty-state">
      <h2>{title}</h2>
      <p className="text-muted">This page is coming soon.</p>
    </div>
  </div>
);

/**
 * The root application component.
 * Sets up global providers, layout structure, and route definitions.
 */
export function App() {
  return (
    <AuthProvider>
      <div className="app-layout">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/search" element={<StubPage title="Discover" />} />
          <Route path="/categories" element={<StubPage title="Categories" />} />
          <Route path="/sell" element={<StubPage title="Sell Item" />} />
          <Route path="*" element={
            <div className="main-content container flex items-center justify-center">
               <div className="empty-state">
                 <h2>404 Not Found</h2>
                 <p className="text-muted">This page doesn't exist.</p>
               </div>
            </div>
          } />
        </Routes>
      </div>
    </AuthProvider>
  );
}

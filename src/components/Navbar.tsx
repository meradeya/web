import { Link, useNavigate } from "react-router-dom";
import { Search, User, LogOut } from "lucide-react";
import { useAuth } from "../AuthContext";

export function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="brand">
          <span className="brand-dot"></span>
          Meradeya
        </Link>
        
        <div className="nav-links">
          <Link to="/search" className="nav-link">Discover</Link>
          <Link to="/categories" className="nav-link">Categories</Link>
          {isAuthenticated && <Link to="/sell" className="nav-link">Sell Item</Link>}
        </div>

        <div className="flex items-center gap-4">
          <button className="btn-icon">
            <Search size={20} />
          </button>
          
          {isAuthenticated ? (
            <>
              <Link to="/profile" className="btn-icon" title="Profile">
                <User size={20} />
              </Link>
              <button className="btn-icon" onClick={handleLogout} title="Log Out">
                <LogOut size={20} />
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              Connect
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

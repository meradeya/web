import { type SyntheticEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import useSWR from "swr";
import { apiCall, fetcher } from "../api";
import { useAuth } from "../AuthContext";
import { AlertCircle, ArrowRight, Upload } from "lucide-react";

export function Sell() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("MDL");
  const [condition, setCondition] = useState("GOOD");
  const [location, setLocation] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const { data: categories, error: categoriesError } = useSWR("/categories", fetcher);

  // If not authenticated, redirecting happens via protected route or just button disabled,
  // but let's do a quick redirect if needed. Normally, AuthContext might handle this or we just show a message.
  if (!isAuthenticated) {
    return (
      <div className="main-content container flex items-center justify-center">
        <div className="empty-state">
          <h2>Authentication Required</h2>
          <p className="text-muted">Please log in to sell an item.</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/login")}
            style={{ marginTop: 24 }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!categoryId) {
        throw new Error("Please select a category.");
      }

      // 1. Create the listing (DRAFT)
      const listingData = await apiCall("/listings", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          price: Number.parseFloat(price),
          currency,
          condition,
          location,
          categoryId,
        }),
      });

      const listingId = listingData.id;

      // 2. Upload photo if selected
      if (photo) {
        const formData = new FormData();
        formData.append("file", photo);

        const token = localStorage.getItem("accessToken");
        const headers: HeadersInit = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // Use raw fetch for multipart to avoid apiCall setting application/json
        const API_URL = import.meta.env?.VITE_API_URL || "http://localhost:8080/v1.0";
        const photoRes = await fetch(`${API_URL}/listings/${listingId}/photos`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!photoRes.ok) {
          const photoErr = await photoRes.json().catch(() => ({}));
          console.warn("Photo upload failed:", photoErr);
          // We continue because the listing is already created, but we might want to warn the user
        }
      }

      // 3. Publish the listing
      await apiCall(`/listings/${listingId}/publish`, {
        method: "POST",
      });

      navigate(`/listing/${listingId}`);
    } catch (err: any) {
      setError(err.message || "Failed to create listing");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // e.target.files?.[0] can be File | undefined — normalize to File | null for our state
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
  };

  const flattenCategories = (nodes: any[]): any[] => {
    let result: any[] = [];
    if (!nodes) return result;
    for (const node of nodes) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenCategories(node.children));
      }
    }
    return result;
  };

  const allCategories = flattenCategories(categories || []);

  return (
    <div className="auth-container main-content" style={{ maxWidth: 640 }}>
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="auth-header">
          <h1 className="auth-title">Sell an Item</h1>
          <p className="auth-subtitle">List your luxury item on Meradeya</p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "rgba(255,0,0,0.1)",
              color: "#ff4444",
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Title
            </label>
            <input
              id="title"
              type="text"
              className="form-input"
              placeholder="e.g. Vintage Chanel Bag"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="category" className="form-label">
              Category
            </label>
            <select
              id="category"
              className="form-input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              style={{ appearance: "none" }}
            >
              <option value="" disabled>
                Select a category
              </option>
              {categoriesError && <option disabled>Failed to load categories</option>}
              {allCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <textarea
              id="description"
              className="form-input"
              placeholder="Describe your item in detail..."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="meta-grid">
            <div className="form-group">
              <label htmlFor="price" className="form-label">
                Price
              </label>
              <input
                id="price"
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="currency" className="form-label">
                Currency
              </label>
              <select
                id="currency"
                className="form-input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ appearance: "none" }}
              >
                <option value="MDL">MDL</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="meta-grid">
            <div className="form-group">
              <label htmlFor="condition" className="form-label">
                Condition
              </label>
              <select
                id="condition"
                className="form-input"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                style={{ appearance: "none" }}
              >
                <option value="NEW">New</option>
                <option value="LIKE_NEW">Like New</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="location" className="form-label">
                Location
              </label>
              <input
                id="location"
                type="text"
                className="form-input"
                placeholder="e.g. Chisinau"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="photo" className="form-label">
              Photo
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <label
                htmlFor="photo"
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  cursor: "pointer",
                  borderStyle: "dashed",
                }}
              >
                <Upload size={18} /> {photo ? photo.name : "Upload Photo"}
              </label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: "none" }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "16px" }}
            disabled={isLoading}
          >
            {isLoading ? "Publishing..." : "Publish Listing"} <ArrowRight size={18} />
          </button>
        </form>
      </motion.div>
    </div>
  );
}

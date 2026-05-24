  import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import useSWR from "swr";
import { apiCall, fetcher } from "../api";
import { useAuth } from "../AuthContext";
import { AlertCircle, ArrowRight, Upload } from "lucide-react";

type SellMode = "draft" | "publish";

type ListingPayload = Record<string, any>;

function buildListingPayload({
  title,
  description,
  price,
  currency,
  condition,
  location,
  categoryId,
  mode,
}: {
  title: string;
  description: string;
  price: string;
  currency: string;
  condition: string;
  location: string;
  categoryId: string;
  mode: SellMode;
}): ListingPayload {
  const normalizedPrice = Number.parseFloat(price);
  const payload: ListingPayload = {};

  if (title.trim()) payload.title = title.trim();
  if (description.trim()) payload.description = description.trim();
  if (Number.isFinite(normalizedPrice) && normalizedPrice > 0) payload.price = normalizedPrice;
  payload.condition = condition || "GOOD";
  if (mode === "publish") payload.currency = currency;
  if (location.trim()) payload.location = location.trim();
  if (categoryId) payload.categoryId = categoryId;

  return payload;
}

function getPublishValidationMessage({
  title,
  categoryId,
  price,
  condition,
}: {
  title: string;
  categoryId: string;
  price: string;
  condition: string;
}) {
  const normalizedPrice = Number.parseFloat(price);

  if (
    title.trim().length === 0 ||
    categoryId.length === 0 ||
    price.trim().length === 0 ||
    !Number.isFinite(normalizedPrice) ||
    normalizedPrice <= 0 ||
    condition.length === 0
  ) {
    return "Fill Title, Category, Price, and Condition to publish now.";
  }

  return "";
}

async function uploadListingPhoto({ listingId, photo }: { listingId: string; photo: File }) {
  const formData = new FormData();
  formData.append("file", photo);

  const token = localStorage.getItem("accessToken");
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const API_URL = import.meta.env?.VITE_API_URL || "http://localhost:8080/v1.0";
  const photoRes = await fetch(`${API_URL}/listings/${listingId}/photos`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!photoRes.ok) {
    const photoErr = await photoRes.json().catch(() => ({}));
    console.warn("Photo upload failed:", photoErr);
  }
}

type PreviewPhoto = {
  file: File;
  blobUrl: string;
};

export function Sell() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("MDL");
  const [condition, setCondition] = useState("GOOD");
  const [location, setLocation] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [photos, setPhotos] = useState<PreviewPhoto[]>([]);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitMode, setSubmitMode] = useState<"draft" | "publish" | null>(null);

  const navigate = useNavigate();
  const { isAuthenticated, isInitializing } = useAuth();

  const { data: categories, error: categoriesError } = useSWR("/categories", fetcher);

  // Cleanup blob URLs on unmount or when photos change
  useEffect(() => {
    return () => {
      photos.forEach((p) => {
        URL.revokeObjectURL(p.blobUrl);
      });
    };
  }, []);

  // Show loading while auth state is being initialized
  if (isInitializing) {
    return (
      <div className="auth-container main-content" style={{ maxWidth: 640 }}>
        <div className="skeleton" style={{ height: 400, borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  // If not authenticated, show auth required message
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

  const hasAnyInput =
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    price.trim().length > 0 ||
    location.trim().length > 0 ||
    categoryId.length > 0 ||
    photos !== null ||
    currency !== "MDL" ||
    condition !== "GOOD";

  const requiredFieldsComplete =
    title.trim().length > 0 &&
    categoryId.length > 0 &&
    price.trim().length > 0 &&
    Number.isFinite(Number.parseFloat(price)) &&
    Number.parseFloat(price) > 0 &&
    condition.length > 0;

  const handleSubmit = async (mode: SellMode) => {
    setError("");
    setIsLoading(true);
    setSubmitMode(mode);

    try {
      if (mode === "publish") {
        const validationMessage = getPublishValidationMessage({
          title,
          categoryId,
          price,
          condition,
        });

        if (validationMessage) {
          setError(validationMessage);
          return;
        }
      }

      const payload = buildListingPayload({
        title,
        description,
        price,
        currency,
        condition,
        location,
        categoryId,
        mode,
      });

      // 1. Create the listing (DRAFT)
      const listingData = await apiCall("/listings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const listingId = listingData.id;

      // 2. Upload photos if selected
      if (photos && photos.length > 0) {
        // Upload sequentially to avoid any race conditions on backend displayOrder
        for (const p of photos) {
          await uploadListingPhoto({ listingId, photo: p.file });
        }
      }

      // 3. Publish only when requested
      if (mode === "publish") {
        await apiCall(`/listings/${listingId}/publish`, {
          method: "POST",
        });
      }

      navigate(mode === "draft" ? `/listing/${listingId}?edit=1` : `/listing/${listingId}`);
    } catch (err: any) {
      setError(err.message || "Failed to create listing");
    } finally {
      setIsLoading(false);
      setSubmitMode(null);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const newPreviewPhotos = selectedFiles.map((file) => ({
        file,
        blobUrl: URL.createObjectURL(file), // Generate once
      }));

      setPhotos((prev) => {
        const combined = [...prev, ...newPreviewPhotos];
        // Clean up excess blob URLs if we truncate
        if (combined.length > 10) {
          combined.slice(10).forEach(p => URL.revokeObjectURL(p.blobUrl));
        }
        return combined.slice(0, 10);
      });
      // Clear input
      e.target.value = "";
    }
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

        <form onSubmit={(e) => e.preventDefault()}>
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
              Photos (Max 10)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {photos.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "relative",
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#333",
                  }}
                >
                  <img
                    src={p.blobUrl}
                    alt="preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(p.blobUrl);
                      setPhotos(photos.filter((_, i) => i !== idx));
                    }}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      background: "rgba(0,0,0,0.5)",
                      border: "none",
                      color: "white",
                      borderRadius: "50%",
                      width: 20,
                      height: 20,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            {photos.length < 10 && (
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
                  <Upload size={18} /> Upload Photos
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", marginTop: "16px" }}
            disabled={isLoading || !hasAnyInput}
            onClick={() => void handleSubmit("draft")}
          >
            {isLoading && submitMode === "draft" ? "Saving Draft..." : "Save as Draft"}{" "}
            <ArrowRight size={18} />
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "12px" }}
            disabled={isLoading || !requiredFieldsComplete}
            onClick={() => void handleSubmit("publish")}
          >
            {isLoading && submitMode === "publish" ? "Publishing..." : "Publish Now"}{" "}
            <ArrowRight size={18} />
          </button>

          {hasAnyInput && !requiredFieldsComplete && (
            <p className="text-muted" style={{ marginTop: 12, fontSize: "0.9rem" }}>
              You can save this as a draft now. To publish immediately, fill Title, Category, Price,
              and Condition.
            </p>
          )}
        </form>
      </motion.div>
    </div>
  );
}

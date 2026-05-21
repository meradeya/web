import {
  type Dispatch,
  type SetStateAction,
  type SyntheticEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR from "swr";
import { motion } from "framer-motion";
import { apiCall, fetcher, formatPrice, resolvePhotoUrl } from "../api";
import { useAuth } from "../AuthContext";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Clock,
  Edit2,
  ImageOff,
  MapPin,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const flattenCategories = (nodes: any[]): any[] => {
  const result: any[] = [];
  for (const node of nodes || []) {
    result.push(node);
    if (node.children?.length) result.push(...flattenCategories(node.children));
  }
  return result;
};

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type ListingAction = "publish" | "archive" | "delete";

type ListingFormData = {
  categoryId: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  condition: string;
  location: string;
};

const LISTING_CONFIRM_MESSAGES: Record<ListingAction, string> = {
  publish: "Publish this listing?",
  archive: "Archive this listing? It will be hidden from buyers.",
  delete: "Permanently delete this listing? This cannot be undone.",
};

const getListingConfirmMessage = (action: ListingAction) => LISTING_CONFIRM_MESSAGES[action];

type ListingManageActionsProps = {
  listing: any;
  isEditing: boolean;
  actionLoading: ListingAction | null;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onRequestAction: (action: ListingAction) => void;
};

function ListingManageActions({
  listing,
  isEditing,
  actionLoading,
  onStartEditing,
  onCancelEditing,
  onRequestAction,
}: Readonly<ListingManageActionsProps>) {
  if (isEditing) {
    return (
      <div className="detail-actions">
        <button className="btn btn-secondary" onClick={onCancelEditing}>
          <X size={18} /> Cancel Edit
        </button>
      </div>
    );
  }

  return (
    <div className="detail-actions">
      <button className="btn btn-secondary" onClick={onStartEditing}>
        <Edit2 size={18} /> Edit Listing
      </button>

      {listing.status === "DRAFT" && (
        <button
          className="btn btn-primary"
          onClick={() => onRequestAction("publish")}
          disabled={actionLoading === "publish"}
        >
          <ArrowRight size={18} /> {actionLoading === "publish" ? "Publishing..." : "Publish"}
        </button>
      )}

      {listing.status === "ACTIVE" && (
        <>
          <button
            className="btn btn-secondary"
            onClick={() => onRequestAction("archive")}
            disabled={actionLoading === "archive"}
          >
            <Archive size={18} /> {actionLoading === "archive" ? "Archiving..." : "Archive"}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => onRequestAction("delete")}
            disabled={actionLoading === "delete"}
          >
            <Trash2 size={18} /> {actionLoading === "delete" ? "Deleting..." : "Delete"}
          </button>
        </>
      )}

      {listing.status === "ARCHIVED" && (
        <>
          <button
            className="btn btn-primary"
            onClick={() => onRequestAction("publish")}
            disabled={actionLoading === "publish"}
          >
            <ArrowRight size={18} />{" "}
            {actionLoading === "publish" ? "Re-activating..." : "Re-activate"}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => onRequestAction("delete")}
            disabled={actionLoading === "delete"}
          >
            <Trash2 size={18} /> {actionLoading === "delete" ? "Deleting..." : "Delete"}
          </button>
        </>
      )}
    </div>
  );
}

type ListingPendingConfirmationProps = {
  action: ListingAction;
  actionLoading: ListingAction | null;
  onConfirm: (action: ListingAction) => void;
  onCancel: () => void;
};

function ListingPendingConfirmation({
  action,
  actionLoading,
  onConfirm,
  onCancel,
}: Readonly<ListingPendingConfirmationProps>) {
  const message = getListingConfirmMessage(action);

  return (
    <div
      style={{
        backgroundColor: "rgba(196, 255, 0, 0.05)",
        border: "1px solid rgba(196, 255, 0, 0.2)",
        borderRadius: "var(--radius-md)",
        padding: "16px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <div>
        <p style={{ fontWeight: 600, marginBottom: "4px" }}>{message}</p>
      </div>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          className="btn btn--compact btn-danger"
          onClick={() => onConfirm(action)}
          disabled={actionLoading === action}
        >
          {actionLoading === action ? "Processing..." : "Confirm"}
        </button>
        <button
          className="btn btn--compact btn-secondary"
          onClick={onCancel}
          disabled={actionLoading !== null}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

type ListingEditFormProps = {
  listing: any;
  categoryOptions: any[];
  formData: ListingFormData;
  setFormData: Dispatch<SetStateAction<ListingFormData>>;
  isSaving: boolean;
  photoUploadLoading: boolean;
  photoUploadError: string;
  photoDeleteLoading: string | null;
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoDelete: (photoId: string) => void;
};

function ListingEditForm({
  listing,
  categoryOptions,
  formData,
  setFormData,
  isSaving,
  photoUploadLoading,
  photoUploadError,
  photoDeleteLoading,
  onSubmit,
  onPhotoUpload,
  onPhotoDelete,
}: Readonly<ListingEditFormProps>) {
  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="form-group">
        <label htmlFor="categoryId" className="form-label">
          Category
        </label>
        <select
          id="categoryId"
          className="form-input"
          value={formData.categoryId}
          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
        >
          <option value="">Select a category</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="title" className="form-label">
          Title
        </label>
        <input
          id="title"
          className="form-input"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label htmlFor="description" className="form-label">
          Description
        </label>
        <textarea
          id="description"
          className="form-input"
          rows={5}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div className="meta-grid">
        <div className="form-group">
          <label htmlFor="price" className="form-label">
            Price
          </label>
          <input
            id="price"
            className="form-input"
            type="number"
            step="0.01"
            min="0.01"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="currency" className="form-label">
            Currency
          </label>
          <select
            id="currency"
            className="form-input"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
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
            value={formData.condition}
            onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
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
            className="form-input"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="photo-upload" className="form-label">
          Photos
        </label>
        {listing.photos?.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            {listing.photos.map((photo: any, index: number) => (
              <div
                key={photo.id}
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                  background: "#1a1a20",
                  border: "1px solid var(--border)",
                }}
              >
                <img
                  src={resolvePhotoUrl(photo.url)}
                  alt={`${listing.title} gallery ${index + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    width: "32px",
                    height: "32px",
                    padding: "0",
                    borderRadius: "50%",
                  }}
                  onClick={() => onPhotoDelete(photo.id)}
                  disabled={photoDeleteLoading === photo.id}
                >
                  {photoDeleteLoading === photo.id ? (
                    <span style={{ fontSize: "12px" }}>...</span>
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {photoUploadError && (
          <div
            style={{
              backgroundColor: "rgba(255,0,0,0.1)",
              border: "1px solid rgba(255,68,68,0.3)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#ffb3b3",
            }}
          >
            <AlertCircle size={18} /> {photoUploadError}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <label
            htmlFor="photo-upload"
            className="btn btn-secondary"
            style={{
              flex: 1,
              justifyContent: "center",
              cursor: "pointer",
              borderStyle: "dashed",
            }}
          >
            <Upload size={18} /> {photoUploadLoading ? "Uploading..." : "Add Photo"}
          </label>
          <input
            id="photo-upload"
            type="file"
            accept="image/*"
            onChange={onPhotoUpload}
            disabled={photoUploadLoading}
            style={{ display: "none" }}
          />
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Changes"} <Save size={18} />
      </button>
    </form>
  );
}

function ListingReadOnlyDetails({ listing }: Readonly<{ listing: any }>) {
  return (
    <>
      <div className="detail-description">{listing.description}</div>

      <div className="meta-grid">
        <div className="meta-item">
          <span className="meta-label flex items-center gap-2">
            <MapPin size={14} /> Location
          </span>
          <span className="meta-value">{listing.location || "Not specified"}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label flex items-center gap-2">
            <Clock size={14} /> Listed
          </span>
          <span className="meta-value">{new Date(listing.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label flex items-center gap-2">
            <ShieldCheck size={14} /> Seller ID
          </span>
          <span
            className="meta-value"
            style={{
              fontSize: "0.875rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {listing.sellerId}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Status</span>
          <span className="meta-value" style={{ color: "var(--accent)" }}>
            {listing.status}
          </span>
        </div>
      </div>
    </>
  );
}

export function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    data: listing,
    error,
    isLoading,
    mutate,
  } = useSWR(id ? `/listings/${id}` : null, fetcher);
  const { data: categories } = useSWR("/categories", fetcher);

  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "1");
  const [saveError, setSaveError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<ListingAction | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [photoUploadLoading, setPhotoUploadLoading] = useState(false);
  const [photoDeleteLoading, setPhotoDeleteLoading] = useState<string | null>(null);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<ListingAction | null>(null);
  const [formData, setFormData] = useState<ListingFormData>({
    categoryId: "",
    title: "",
    description: "",
    price: "",
    currency: "MDL",
    condition: "GOOD",
    location: "",
  });

  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      setIsEditing(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!listing) return;

    setFormData({
      categoryId: listing.categoryId || "",
      title: listing.title || "",
      description: listing.description || "",
      price: listing.price?.toString() || "",
      currency: listing.currency || "MDL",
      condition: listing.condition || "GOOD",
      location: listing.location || "",
    });
  }, [listing]);

  const canManage = Boolean(listing && isAuthenticated && userId && listing.sellerId === userId);
  const mainImage =
    listing?.photos && listing.photos.length > 0
      ? resolvePhotoUrl(
          listing.photos.find((p: any) => p.displayOrder === 0)?.url || listing.photos[0].url,
        )
      : null;
  const categoryOptions = useMemo(() => flattenCategories(categories || []), [categories]);

  const setBusyAction = (action: ListingAction | null) => {
    setActionLoading(action);
  };

  const handleSave = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!listing) return;

    setSaveError("");
    setIsSaving(true);
    try {
      // Build a minimal PATCH payload that only sends fields that changed (or are intentionally set).
      const payload: Record<string, any> = { version: listing.version };

      const cat = normalizeText(formData.categoryId);
      if (cat !== (listing.categoryId || null)) payload.categoryId = cat;

      const t = normalizeText(formData.title);
      if (t !== (listing.title || null)) payload.title = t;

      const d = normalizeText(formData.description);
      if (d !== (listing.description || null)) payload.description = d;

      const p = formData.price.trim() ? Number.parseFloat(formData.price) : null;
      if ((p === null && listing.price != null) || (p != null && p !== listing.price))
        payload.price = p;

      const curr = normalizeText(formData.currency);
      if (curr !== (listing.currency || null)) payload.currency = curr;

      const cond = normalizeText(formData.condition);
      if (cond !== (listing.condition || null)) payload.condition = cond;

      const loc = normalizeText(formData.location);
      if (loc !== (listing.location || null)) payload.location = loc;

      await apiCall(`/listings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await mutate();
      setIsEditing(false);
      setSearchParams({});
    } catch (err: any) {
      setSaveError(err.message || "Failed to update listing");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusAction = async (action: ListingAction) => {
    if (!id) return;

    // Show inline confirmation instead
    setPendingConfirmAction(action);
  };

  const confirmAction = async (action: ListingAction) => {
    if (!id) return;
    setActionError("");
    setBusyAction(action);
    try {
      await apiCall(`/listings/${id}/${action}`, { method: "POST" });
      if (action === "delete") {
        navigate("/profile");
        return;
      }
      await mutate();
      setIsEditing(false);
      setSearchParams({});
    } catch (err: any) {
      setActionError(err.message || `Failed to ${action} listing`);
    } finally {
      setBusyAction(null);
      setPendingConfirmAction(null);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !e.target.files?.[0]) return;
    const file = e.target.files[0];

    setPhotoUploadError("");
    setPhotoUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const API_URL = import.meta.env?.VITE_API_URL || "http://localhost:8080/v1.0";
      const res = await fetch(`${API_URL}/listings/${id}/photos`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.title || "Failed to upload photo");
      }

      await mutate();
      e.target.value = ""; // Reset file input
    } catch (err: any) {
      setPhotoUploadError(err.message || "Failed to upload photo");
    } finally {
      setPhotoUploadLoading(false);
    }
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!id) return;

    setPhotoDeleteLoading(photoId);
    try {
      await apiCall(`/listings/${id}/photos/${photoId}`, { method: "DELETE" });
      await mutate();
    } catch (err: any) {
      setPhotoUploadError(err.message || "Failed to delete photo");
    } finally {
      setPhotoDeleteLoading(null);
    }
  };

  if (isLoading)
    return (
      <div className="main-content container" style={{ paddingTop: "120px" }}>
        <div className="skeleton" style={{ height: 400, borderRadius: "var(--radius-lg)" }} />
      </div>
    );

  if (error || !listing)
    return (
      <div className="main-content container" style={{ paddingTop: "120px" }}>
        <div className="empty-state">
          <h3>Listing not found</h3>
          <p className="text-muted">The item you are looking for may have been removed.</p>
          <Link
            to={canManage ? "/profile" : "/"}
            className="btn btn-secondary"
            style={{ marginTop: 24 }}
          >
            Back
          </Link>
        </div>
      </div>
    );

  return (
    <div className="main-content container" style={{ paddingTop: "120px" }}>
      <Link
        to={canManage ? "/profile" : "/"}
        className="btn btn-secondary"
        style={{ marginBottom: 40, alignSelf: "flex-start" }}
      >
        <ArrowLeft size={18} /> Back
      </Link>

      <motion.div
        className="detail-grid"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="detail-gallery">
          {mainImage ? (
            <img src={mainImage} alt={listing.title} />
          ) : (
            <div
              className="text-muted flex items-center justify-center"
              style={{ width: "100%", height: "100%" }}
            >
              <ImageOff size={64} strokeWidth={1} opacity={0.5} />
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-category">{listing.condition.replaceAll("_", " ")}</div>
          <h1 className="detail-title">{listing.title}</h1>
          <div className="detail-price">{formatPrice(listing.price, listing.currency)}</div>

          {canManage ? (
            <ListingManageActions
              listing={listing}
              isEditing={isEditing}
              actionLoading={actionLoading}
              onStartEditing={() => {
                setIsEditing(true);
                setSearchParams({ edit: "1" });
              }}
              onCancelEditing={() => {
                setIsEditing(false);
                setSearchParams({});
              }}
              onRequestAction={(action) => void handleStatusAction(action)}
            />
          ) : (
            <div className="detail-actions detail-actions--buyer">
              <button className="btn btn-primary" style={{ flex: 1 }}>
                Purchase Item
              </button>
              <button className="btn btn-secondary">Make Offer</button>
            </div>
          )}

          {(saveError || actionError) && (
            <div className="empty-state" style={{ marginTop: 16, padding: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Action failed</h3>
              <p className="text-muted">{saveError || actionError}</p>
            </div>
          )}

          {pendingConfirmAction && (
            <ListingPendingConfirmation
              action={pendingConfirmAction}
              actionLoading={actionLoading}
              onConfirm={(action) => void confirmAction(action)}
              onCancel={() => setPendingConfirmAction(null)}
            />
          )}

          {photoUploadError && (
            <div
              style={{
                backgroundColor: "rgba(255,0,0,0.1)",
                border: "1px solid rgba(255,68,68,0.3)",
                borderRadius: "var(--radius-md)",
                padding: "12px 16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#ff7b7b",
              }}
            >
              <AlertCircle size={18} /> {photoUploadError}
            </div>
          )}

          {isEditing ? (
            <ListingEditForm
              listing={listing}
              categoryOptions={categoryOptions}
              formData={formData}
              setFormData={setFormData}
              isSaving={isSaving}
              photoUploadLoading={photoUploadLoading}
              photoUploadError={photoUploadError}
              photoDeleteLoading={photoDeleteLoading}
              onSubmit={handleSave}
              onPhotoUpload={(e) => void handlePhotoUpload(e)}
              onPhotoDelete={(photoId) => void handlePhotoDelete(photoId)}
            />
          ) : (
            <ListingReadOnlyDetails listing={listing} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

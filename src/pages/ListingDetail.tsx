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
import { motion, AnimatePresence } from "framer-motion";
import { apiCall, fetcher, formatPrice, resolvePhotoUrl, generateId } from "../api";
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
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  GripHorizontal,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

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

export type EditPhoto = {
  id: string; // local unique ID
  originalId?: string; // from backend if it existed
  url?: string;
  file?: File;
  blobUrl?: string; // pre-generated blob URL for performance
  deleted: boolean;
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
  editPhotos: EditPhoto[];
  setEditPhotos: Dispatch<SetStateAction<EditPhoto[]>>;
  isSaving: boolean;
  photoUploadError: string;
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoDelete: (photoId: string) => void;
  onPhotoRestore: (photoId: string) => void;
};

function ListingEditForm({
  listing,
  categoryOptions,
  formData,
  setFormData,
  editPhotos,
  setEditPhotos,
  isSaving,
  photoUploadError,
  onSubmit,
  onPhotoUpload,
  onPhotoDelete,
  onPhotoRestore,
}: Readonly<ListingEditFormProps>) {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const startIndex = result.source.index;
    const endIndex = result.destination.index;

    // If nothing changed, do nothing
    if (startIndex === endIndex) return;

    // Use functional state update to avoid stale closures when working with current state
    setEditPhotos((prev) => {
      const reorderedPhotos = Array.from(prev);
      // Guard against invalid indexes
      if (startIndex < 0 || startIndex >= reorderedPhotos.length) return prev;
      const [removed] = reorderedPhotos.splice(startIndex, 1);
      if (!removed) return prev;
      const insertIndex = Math.max(0, Math.min(endIndex, reorderedPhotos.length));
      reorderedPhotos.splice(insertIndex, 0, removed);
      return reorderedPhotos;
    });
  };

  const currentActivePhotos = editPhotos.filter((p) => !p.deleted).length;

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
        <label className="form-label">Photos ({currentActivePhotos}/10)</label>

        {editPhotos.length > 0 && (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="photos-list" direction="horizontal">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  {editPhotos.map((photo, index) => (
                    <Draggable key={photo.id} draggableId={photo.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            position: "relative",
                            width: "100px",
                            height: "100px",
                            borderRadius: "var(--radius-md)",
                            overflow: "hidden",
                            background: "#1a1a20",
                            border: photo.deleted
                              ? "2px dashed #ff4444"
                              : "1px solid var(--border)",
                            opacity: photo.deleted ? 0.5 : 1,
                            boxShadow: snapshot.isDragging ? "0 5px 15px rgba(0,0,0,0.5)" : "none",
                            ...provided.draggableProps.style,
                          }}
                        >
                          <img
                            src={
                              photo.blobUrl
                                ? photo.blobUrl
                                : resolvePhotoUrl(photo.url || "")
                            }
                            alt={`Photo ${index + 1}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />

                          <div
                            {...provided.dragHandleProps}
                            style={{
                              position: "absolute",
                              top: "4px",
                              left: "4px",
                              width: "24px",
                              height: "24px",
                              background: "rgba(0,0,0,0.5)",
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                            }}
                          >
                            <GripHorizontal size={14} />
                          </div>

                          {photo.deleted ? (
                            <button
                              type="button"
                              className="btn"
                              style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                width: "24px",
                                height: "24px",
                                padding: "0",
                                borderRadius: "50%",
                                background: "var(--surface)",
                                color: "white",
                              }}
                              onClick={() => onPhotoRestore(photo.id)}
                            >
                              <RotateCcw size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                width: "24px",
                                height: "24px",
                                padding: "0",
                                borderRadius: "50%",
                              }}
                              onClick={() => onPhotoDelete(photo.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
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

        {currentActivePhotos < 10 && (
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
              <Upload size={18} /> Upload Photos
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={onPhotoUpload}
              style={{ display: "none" }}
            />
          </div>
        )}
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
  const [photoDeleteLoading, setPhotoDeleteLoading] = useState<string | null>(null);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<ListingAction | null>(null);
   const [editPhotos, setEditPhotos] = useState<EditPhoto[]>([]);
   const [currentImageIndex, setCurrentImageIndex] = useState(0);
   const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");

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

    setEditPhotos(
      (listing.photos || []).map((p: any) => ({
        id: p.id,
        originalId: p.id,
        url: p.url,
        deleted: false,
      })),
    );
   }, [listing]);

   // Cleanup blob URLs when component unmounts or photos change
   useEffect(() => {
     return () => {
       editPhotos.forEach((photo) => {
         if (photo.blobUrl) {
           URL.revokeObjectURL(photo.blobUrl);
         }
       });
     };
   }, []);

  const canManage = Boolean(listing && isAuthenticated && userId && listing.sellerId === userId);
  const categoryOptions = useMemo(() => flattenCategories(categories || []), [categories]);

  const setBusyAction = (action: ListingAction | null) => {
    setActionLoading(action);
  };

  const handleSave = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!listing || !id) return;

    setSaveError("");
    setIsSaving(true);
    try {
      // 1. Process Photos FIRST
      let trackingListing = listing;

      // Handle deletes
      for (const p of editPhotos) {
        if (p.deleted && p.originalId) {
          trackingListing = await apiCall(`/listings/${id}/photos/${p.originalId}`, {
            method: "DELETE",
          });
        }
      }

      // Handle uploads
      const finalIdsInOrder: string[] = [];
      const token = localStorage.getItem("accessToken");
      const API_URL = import.meta.env?.VITE_API_URL || "http://localhost:8080/v1.0";

      for (const p of editPhotos) {
        if (p.deleted) continue;

        if (p.originalId) {
          finalIdsInOrder.push(p.originalId);
        } else if (p.file) {
          const mfd = new FormData();
          mfd.append("file", p.file);

          const res = await fetch(`${API_URL}/listings/${id}/photos`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: mfd,
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.title || "Failed to upload a photo");
          }
          const updatedListing = await res.json();
          const prevIds = new Set(trackingListing.photos.map((ph: any) => ph.id));
          const newlyAdded = updatedListing.photos.find((ph: any) => !prevIds.has(ph.id));
          if (newlyAdded) {
            finalIdsInOrder.push(newlyAdded.id);
          }
          trackingListing = updatedListing;
        }
      }

      // Reorder photos
      if (finalIdsInOrder.length > 0) {
        await apiCall(`/listings/${id}/photos/reorder`, {
          method: "POST",
          body: JSON.stringify({ photoIds: finalIdsInOrder }),
        });
      }

      // 2. Build PATCH payload for listing details
      // Get the latest version directly after we made changes
      const latestListingRes = await apiCall(`/listings/${id}`, { method: "GET" });
      const payload: Record<string, any> = { version: latestListingRes.version };

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

      if (Object.keys(payload).length > 1) {
        // more than just "version"
        await apiCall(`/listings/${id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }

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
     if (!e.target.files) return;
     const files = Array.from(e.target.files);

     setEditPhotos((prev) => {
       const activeCount = prev.filter((p) => !p.deleted).length;
       const allowedCount = 10 - activeCount;
       const toAdd = files.slice(0, allowedCount).map((f) => ({
         id: generateId(),
         file: f,
         blobUrl: URL.createObjectURL(f), // Generate blob URL once
         deleted: false,
       }));
       return [...prev, ...toAdd];
     });

     // clear input
     e.target.value = "";
   };

  const handlePhotoDelete = (photoId: string) => {
    setEditPhotos((prev) =>
      prev.map((p) => {
        if (p.id === photoId) {
          return { ...p, deleted: true };
        }
        return p;
      }),
    );
  };

  const handlePhotoRestore = (photoId: string) => {
    setEditPhotos((prev) => {
      const activeCount = prev.filter((x) => !x.deleted).length;
      if (activeCount >= 10) return prev; // Cannot restore if already 10
      return prev.map((p) => (p.id === photoId ? { ...p, deleted: false } : p));
    });
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
          {listing.photos && listing.photos.length > 0 ? (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
               <AnimatePresence mode="wait">
                 <motion.img
                   key={currentImageIndex}
                   src={resolvePhotoUrl(listing.photos[currentImageIndex].url)}
                   alt={`${listing.title} - ${currentImageIndex}`}
                   initial={{
                     x: slideDirection === "right" ? 100 : -100,
                     opacity: 0,
                   }}
                   animate={{ x: 0, opacity: 1 }}
                   exit={{
                     x: slideDirection === "right" ? -100 : 100,
                     opacity: 0,
                   }}
                   transition={{
                     duration: 0.4,
                     ease: [0.25, 0.46, 0.45, 0.94],
                   }}
                   style={{
                     width: "100%",
                     height: "100%",
                     objectFit: "cover",
                     position: "absolute",
                     top: 0,
                     left: 0,
                   }}
                 />
               </AnimatePresence>

              {listing.photos.length > 1 && (
                <>
                   <button
                     className="btn"
                     onClick={() => {
                       setSlideDirection("left");
                       setCurrentImageIndex((i) => Math.max(0, i - 1));
                     }}
                     disabled={currentImageIndex === 0}
                     style={{
                       position: "absolute",
                       left: 16,
                       top: "50%",
                       transform: "translateY(-50%)",
                       background: "rgba(0,0,0,0.5)",
                       color: "white",
                       borderRadius: "50%",
                       width: 40,
                       height: 40,
                       padding: 0,
                       display: "flex",
                       alignItems: "center",
                       justifyContent: "center",
                       opacity: currentImageIndex === 0 ? 0.3 : 1,
                     }}
                   >
                     <ChevronLeft size={24} />
                   </button>
                   <button
                     className="btn"
                     onClick={() => {
                       setSlideDirection("right");
                       setCurrentImageIndex((i) =>
                         Math.min(listing.photos.length - 1, i + 1),
                       );
                     }}
                     disabled={currentImageIndex === listing.photos.length - 1}
                     style={{
                       position: "absolute",
                       right: 16,
                       top: "50%",
                       transform: "translateY(-50%)",
                       background: "rgba(0,0,0,0.5)",
                       color: "white",
                       borderRadius: "50%",
                       width: 40,
                       height: 40,
                       padding: 0,
                       display: "flex",
                       alignItems: "center",
                       justifyContent: "center",
                       opacity: currentImageIndex === listing.photos.length - 1 ? 0.3 : 1,
                     }}
                   >
                     <ChevronRight size={24} />
                   </button>

                   <div
                     style={{
                       position: "absolute",
                       bottom: 16,
                       left: "50%",
                       transform: "translateX(-50%)",
                       display: "flex",
                       gap: 8,
                       alignItems: "center",
                       justifyContent: "center",
                       width: "calc(100% - 32px)",
                       maxWidth: "600px",
                     }}
                   >
                     {listing.photos.map((_: any, idx: number) => (
                       <motion.button
                         key={idx}
                         onClick={() => {
                           setSlideDirection(idx > currentImageIndex ? "right" : "left");
                           setCurrentImageIndex(idx);
                         }}
                         whileHover={{ scale: 1.05 }}
                         whileTap={{ scale: 0.95 }}
                         style={{
                           width: 60,
                           height: 60,
                           borderRadius: "var(--radius-sm)",
                           border:
                             idx === currentImageIndex
                               ? "2px solid var(--accent)"
                               : "1px solid rgba(255,255,255,0.2)",
                           padding: 0,
                           overflow: "hidden",
                           background: "rgba(0,0,0,0.3)",
                           cursor: "pointer",
                           flexShrink: 0,
                         }}
                       >
                         <img
                           src={resolvePhotoUrl(listing.photos[idx].url)}
                           alt={`Thumbnail ${idx + 1}`}
                           style={{
                             width: "100%",
                             height: "100%",
                             objectFit: "cover",
                           }}
                         />
                       </motion.button>
                     ))}
                   </div>
                </>
              )}
            </div>
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
              editPhotos={editPhotos}
              setEditPhotos={setEditPhotos}
              isSaving={isSaving}
              photoUploadError={photoUploadError}
              onSubmit={handleSave}
              onPhotoUpload={(e) => void handlePhotoUpload(e)}
              onPhotoDelete={(photoId) => handlePhotoDelete(photoId)}
              onPhotoRestore={(photoId) => handlePhotoRestore(photoId)}
            />
          ) : (
            <ListingReadOnlyDetails listing={listing} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

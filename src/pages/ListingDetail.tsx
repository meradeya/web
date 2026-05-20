import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { fetcher, formatPrice } from "../api";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, MapPin, Clock, ImageOff } from "lucide-react";

export function ListingDetail() {
  const { id } = useParams();
  const { data: listing, error, isLoading } = useSWR(`/listings/${id}`, fetcher);

  if (isLoading)
    return (
      <div className="main-content container" style={{ paddingTop: "120px" }}>
        <div className="skeleton" style={{ height: 400, borderRadius: "var(--radius-lg)" }}></div>
      </div>
    );

  if (error || !listing)
    return (
      <div className="main-content container" style={{ paddingTop: "120px" }}>
        <div className="empty-state">
          <h3>Listing not found</h3>
          <p className="text-muted">The item you are looking for may have been removed.</p>
          <Link to="/" className="btn btn-secondary" style={{ marginTop: 24 }}>
            Back to Home
          </Link>
        </div>
      </div>
    );

  const mainImage =
    listing.photos && listing.photos.length > 0
      ? listing.photos.find((p: any) => p.displayOrder === 0)?.url || listing.photos[0].url
      : null;

  return (
    <div className="main-content container" style={{ paddingTop: "120px" }}>
      <Link
        to="/"
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

          <div
            className="flex gap-4 items-center"
            style={{
              padding: "16px 0",
              borderBottom: "1px solid var(--border)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <button className="btn btn-primary" style={{ flex: 1 }}>
              Purchase Item
            </button>
            <button className="btn btn-secondary">Make Offer</button>
          </div>

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
                style={{ fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis" }}
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
        </div>
      </motion.div>
    </div>
  );
}

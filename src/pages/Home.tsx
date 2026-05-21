import { motion, type Variants } from "framer-motion";
import useSWR from "swr";
import { Link } from "react-router-dom";
import { fetcher, formatPrice, resolvePhotoUrl } from "../api";
import { ArrowRight, Sparkles, ImageOff } from "lucide-react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } },
};

export function Home() {
  const { data, error, isLoading } = useSWR("/feed?size=12", fetcher);

  return (
    <div className="main-content container">
      <section className="hero">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h1 className="hero-title">Discover Unique Finds & Curated Goods.</h1>
          <p className="hero-subtitle">
            Meradeya is the premier marketplace for exceptional items. Trade with confidence in our
            curated ecosystem.
          </p>
          <div className="flex gap-4">
            <button className="btn btn-primary">
              Explore Market <ArrowRight size={18} />
            </button>
            <button className="btn btn-secondary">Sell an Item</button>
          </div>
        </motion.div>
      </section>

      <section>
        <h2 className="section-title">
          <Sparkles size={24} className="text-muted" /> Latest Drops
        </h2>

        {isLoading && (
          <div className="grid">
            {Array.from({ length: 8 }).map(() => (
              <div
                key={crypto.randomUUID()}
                className="card skeleton"
                style={{ height: "400px" }}
              ></div>
            ))}
          </div>
        )}

        {error && (
          <div className="empty-state">
            <h3 style={{ marginBottom: 16 }}>Unable to load feed</h3>
            <p className="text-muted">Is the local development server running?</p>
          </div>
        )}

        {data?.content && (
          <motion.div className="grid" variants={container} initial="hidden" animate="show">
            {data.content.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                <h3>No listings found.</h3>
                <p className="text-muted">Be the first to list an item.</p>
              </div>
            ) : (
              data.content.map((listing: any) => (
                <motion.div key={listing.id} variants={item}>
                  <Link to={`/listing/${listing.id}`} className="card">
                    <div className="card-image-wrap">
                      {listing.firstPhotoUrl ? (
                        <img
                          src={resolvePhotoUrl(listing.firstPhotoUrl)}
                          alt={listing.title}
                          className="card-image"
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center"
                          style={{ width: "100%", height: "100%", color: "var(--border)" }}
                        >
                          <ImageOff size={48} strokeWidth={1} />
                        </div>
                      )}
                      <span className="card-badge">{listing.condition.replaceAll("_", " ")}</span>
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">{listing.title}</h3>
                      <div className="card-price">
                        {formatPrice(listing.price, listing.currency)}
                      </div>
                      <div className="card-meta">
                        <span>{listing.location || "Anywhere"}</span>
                        <span>{new Date(listing.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </section>
    </div>
  );
}

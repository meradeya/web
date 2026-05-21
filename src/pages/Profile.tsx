import { useState, useEffect, type SyntheticEvent } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { fetcher, apiCall, resolvePhotoUrl } from "../api";
import { useAuth } from "../AuthContext";
import { Edit2, MapPin, Mail, AlertCircle, Save, X, ImageOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PROFILE_SKELETON_KEYS = [
  "profile-skeleton-a",
  "profile-skeleton-b",
  "profile-skeleton-c",
  "profile-skeleton-d",
] as const;

type ListingActionConfig = {
  confirmMessage: string;
  endpoint: "publish" | "archive" | "delete";
  errorMessage: string;
};

async function performListingAction({
  listingId,
  config,
  setLoadingFor,
  mutateListings,
}: {
  listingId: string;
  config: ListingActionConfig;
  setLoadingFor: (id: string, v: boolean) => void;
  mutateListings: () => Promise<unknown>;
}) {
  if (!globalThis.confirm(config.confirmMessage)) return;
  setLoadingFor(listingId, true);
  try {
    await apiCall(`/listings/${listingId}/${config.endpoint}`, { method: "POST" });
    await mutateListings();
  } catch (err: any) {
    alert(err.message || config.errorMessage);
  } finally {
    setLoadingFor(listingId, false);
  }
}

function MyListingsSection({
  myListingsData,
  myListingsError,
  myListingsLoading,
  actionLoading,
  navigate,
  setLoadingFor,
  mutateListings,
}: Readonly<{
  myListingsData: any;
  myListingsError: unknown;
  myListingsLoading: boolean;
  actionLoading: Record<string, boolean>;
  navigate: ReturnType<typeof useNavigate>;
  setLoadingFor: (id: string, v: boolean) => void;
  mutateListings: () => Promise<unknown>;
}>) {
  const listings = myListingsData?.content ?? [];
  const hasListings = listings.length > 0;

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ margin: "24px 0 12px" }}>My Listings</h2>

      {myListingsLoading && (
        <div className="grid">
          {PROFILE_SKELETON_KEYS.map((key) => (
            <div key={key} className="card skeleton" style={{ height: 220 }} />
          ))}
        </div>
      )}

      {Boolean(myListingsError) && (
        <div className="empty-state">
          <h3>Unable to load your listings</h3>
          <p className="text-muted">Please try again later.</p>
        </div>
      )}

      {myListingsData?.content?.length === 0 && (
        <div className="empty-state">
          <h3>No listings yet</h3>
          <p className="text-muted">Create your first listing to get started.</p>
        </div>
      )}

      {hasListings && (
        <div className="grid" style={{ marginTop: 12 }}>
          {listings.map((listing: any) => (
            <div key={listing.id} className="card listing-card-preview">
              <div className="listing-grid">
                <div className="card-image-wrap" style={{ height: "100%" }}>
                  {listing.firstPhotoUrl ? (
                    <img
                      src={resolvePhotoUrl(listing.firstPhotoUrl)}
                      alt={listing.title}
                      className="card-image"
                      style={{ height: "100%" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--border)",
                      }}
                    >
                      <ImageOff size={48} strokeWidth={1} />
                    </div>
                  )}
                </div>

                <div
                  className="card-content"
                  style={{
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <h3 className="card-title">{listing.title || "Untitled"}</h3>
                    <div className="text-muted" style={{ marginTop: 6 }}>
                      {listing.location || "—"}
                    </div>
                    <div className="card-price" style={{ marginTop: 12 }}>
                      {listing.currency ? listing.currency + " " + listing.price : listing.price}
                    </div>
                  </div>

                  <div className="card-actions">
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.02)",
                        fontSize: 12,
                      }}
                    >
                      {listing.status}
                    </span>

                    {listing.status === "DRAFT" && (
                      <>
                        <button
                          className="btn btn--compact"
                          onClick={() => navigate(`/listing/${listing.id}?edit=1`)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-primary btn--compact"
                          disabled={!!actionLoading[listing.id]}
                          onClick={() =>
                            void performListingAction({
                              listingId: listing.id,
                              config: {
                                confirmMessage: "Publish this listing?",
                                endpoint: "publish",
                                errorMessage: "Failed to publish listing",
                              },
                              setLoadingFor,
                              mutateListings,
                            })
                          }
                        >
                          {actionLoading[listing.id] ? "Publishing..." : "Publish"}
                        </button>
                      </>
                    )}

                    {listing.status === "ACTIVE" && (
                      <>
                        <button
                          className="btn btn--compact"
                          onClick={() => navigate(`/listing/${listing.id}?edit=1`)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn--compact"
                          onClick={() => navigate(`/listing/${listing.id}`)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn--compact"
                          disabled={!!actionLoading[listing.id]}
                          onClick={() =>
                            void performListingAction({
                              listingId: listing.id,
                              config: {
                                confirmMessage:
                                  "Archive this listing? It will be hidden from buyers.",
                                endpoint: "archive",
                                errorMessage: "Failed to archive listing",
                              },
                              setLoadingFor,
                              mutateListings,
                            })
                          }
                        >
                          {actionLoading[listing.id] ? "Archiving..." : "Archive"}
                        </button>
                        <button
                          className="btn btn-danger btn--compact"
                          disabled={!!actionLoading[listing.id]}
                          onClick={() =>
                            void performListingAction({
                              listingId: listing.id,
                              config: {
                                confirmMessage:
                                  "Permanently delete this listing? This action cannot be undone.",
                                endpoint: "delete",
                                errorMessage: "Failed to delete listing",
                              },
                              setLoadingFor,
                              mutateListings,
                            })
                          }
                        >
                          {actionLoading[listing.id] ? "Deleting..." : "Delete"}
                        </button>
                      </>
                    )}

                    {listing.status === "ARCHIVED" && (
                      <>
                        <button
                          className="btn btn--compact"
                          onClick={() => navigate(`/listing/${listing.id}?edit=1`)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn--compact"
                          onClick={() => navigate(`/listing/${listing.id}`)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-primary btn--compact"
                          disabled={!!actionLoading[listing.id]}
                          onClick={() =>
                            void performListingAction({
                              listingId: listing.id,
                              config: {
                                confirmMessage: "Publish this listing?",
                                endpoint: "publish",
                                errorMessage: "Failed to publish listing",
                              },
                              setLoadingFor,
                              mutateListings,
                            })
                          }
                        >
                          {actionLoading[listing.id] ? "Re-activating..." : "Re-activate"}
                        </button>
                        <button
                          className="btn btn-danger btn--compact"
                          disabled={!!actionLoading[listing.id]}
                          onClick={() =>
                            void performListingAction({
                              listingId: listing.id,
                              config: {
                                confirmMessage:
                                  "Permanently delete this listing? This action cannot be undone.",
                                endpoint: "delete",
                                errorMessage: "Failed to delete listing",
                              },
                              setLoadingFor,
                              mutateListings,
                            })
                          }
                        >
                          {actionLoading[listing.id] ? "Deleting..." : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileView({
  profile,
  isEditing,
  setIsEditing,
  formData,
  setFormData,
  handleSave,
  saveError,
  isSaving,
  myListingsData,
  myListingsError,
  myListingsLoading,
  actionLoading,
  navigate,
  setLoadingFor,
  mutateListings,
}: Readonly<{
  profile: any;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  formData: {
    displayName: string;
    location: string;
    bio: string;
    avatarUrl: string;
  };
  setFormData: (value: {
    displayName: string;
    location: string;
    bio: string;
    avatarUrl: string;
  }) => void;
  handleSave: (e: SyntheticEvent<HTMLFormElement>) => void;
  saveError: string;
  isSaving: boolean;
  myListingsData: any;
  myListingsError: unknown;
  myListingsLoading: boolean;
  actionLoading: Record<string, boolean>;
  navigate: ReturnType<typeof useNavigate>;
  setLoadingFor: (id: string, v: boolean) => void;
  mutateListings: () => Promise<unknown>;
}>) {
  return (
    <div className="main-content container profile-page" style={{ paddingTop: "120px" }}>
      <motion.div
        className="card profile-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ overflow: "visible", padding: "40px" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "32px" }}>
          <h1 className="hero-title" style={{ fontSize: "2.5rem", marginBottom: 0 }}>
            My Profile
          </h1>
          {isEditing ? (
            <button
              className="btn btn-secondary"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              <X size={16} /> Cancel
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
              <Edit2 size={16} /> Edit Profile
            </button>
          )}
        </div>

        {saveError && (
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
            <AlertCircle size={18} /> {saveError}
          </div>
        )}

        <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0 }}>
            <div className="profile-avatar">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Avatar" />
              ) : (
                profile.displayName?.charAt(0).toUpperCase() ||
                profile.email?.charAt(0).toUpperCase()
              )}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: "300px" }}>
            {isEditing ? (
              <form
                onSubmit={handleSave}
                style={{ display: "flex", flexDirection: "column", gap: "16px" }}
              >
                <div className="form-group">
                  <label htmlFor="displayName" className="form-label">
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    className="form-input"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    maxLength={100}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location" className="form-label">
                    Location
                  </label>
                  <input
                    id="location"
                    type="text"
                    className="form-input"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    maxLength={200}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bio" className="form-label">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    className="form-input"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={4}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div style={{ marginTop: "16px" }}>
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    {isSaving ? (
                      "Saving..."
                    ) : (
                      <>
                        <Save size={18} /> Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div>
                  <h2 style={{ fontSize: "2rem", marginBottom: "8px" }}>
                    {profile.displayName || "Anonymous"}
                  </h2>
                  <div className="flex gap-4 text-muted">
                    <span className="flex items-center gap-2">
                      <Mail size={16} /> {profile.email}
                    </span>
                    <span className="flex items-center gap-2">
                      <MapPin size={16} /> {profile.location || "Unknown Location"}
                    </span>
                  </div>
                </div>

                <div>
                  <h3
                    style={{
                      fontSize: "1rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "8px",
                    }}
                  >
                    Bio
                  </h3>
                  <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {profile.bio || "No bio provided."}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    marginTop: "16px",
                    paddingTop: "24px",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      className="text-muted"
                      style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
                    >
                      Account Status
                    </span>
                    <span
                      style={{
                        color: profile.status === "ACTIVE" ? "var(--accent)" : "#ff4444",
                        fontWeight: 600,
                      }}
                    >
                      {profile.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      className="text-muted"
                      style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
                    >
                      Email Verified
                    </span>
                    <span
                      style={{
                        color: profile.emailVerified ? "var(--accent)" : "#ff4444",
                        fontWeight: 600,
                      }}
                    >
                      {profile.emailVerified ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      <div style={{ marginTop: 24 }}>
        <h2 style={{ margin: "24px 0 12px" }}>My Listings</h2>

        <MyListingsSection
          myListingsData={myListingsData}
          myListingsError={myListingsError}
          myListingsLoading={myListingsLoading}
          actionLoading={actionLoading}
          navigate={navigate}
          setLoadingFor={setLoadingFor}
          mutateListings={mutateListings}
        />
      </div>
    </div>
  );
}

export function Profile() {
  const { userId, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const {
    data: profile,
    error,
    isLoading,
    mutate,
  } = useSWR(userId && isAuthenticated ? `/users/${userId}` : null, fetcher);

  // Fetch user's own listings
  const {
    data: myListingsData,
    error: myListingsError,
    isLoading: myListingsLoading,
    mutate: mutateListings,
  } = useSWR(userId && isAuthenticated ? "/listings/own" : null, fetcher);

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    location: "",
    bio: "",
    avatarUrl: "",
  });
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || "",
        location: profile.location || "",
        bio: profile.bio || "",
        avatarUrl: profile.avatarUrl || "",
      });
    }
  }, [profile]);

  if (isLoading) {
    return (
      <div className="main-content container" style={{ paddingTop: "120px" }}>
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }}></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="main-content container" style={{ paddingTop: "120px" }}>
        <div className="empty-state">
          <h3>Failed to load profile</h3>
          <p className="text-muted">There was an issue fetching your account details.</p>
        </div>
      </div>
    );
  }

  const handleSave = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveError("");
    setIsSaving(true);

    try {
      await apiCall(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...formData,
          version: profile.version,
        }),
      });
      await mutate(); // Refresh the SWR cache
      setIsEditing(false);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const setLoadingFor = (id: string, v: boolean) => setActionLoading((s) => ({ ...s, [id]: v }));

  return (
    <ProfileView
      profile={profile}
      isEditing={isEditing}
      setIsEditing={setIsEditing}
      formData={formData}
      setFormData={setFormData}
      handleSave={handleSave}
      saveError={saveError}
      isSaving={isSaving}
      myListingsData={myListingsData}
      myListingsError={myListingsError}
      myListingsLoading={myListingsLoading}
      actionLoading={actionLoading}
      navigate={navigate}
      setLoadingFor={setLoadingFor}
      mutateListings={mutateListings}
    />
  );
}

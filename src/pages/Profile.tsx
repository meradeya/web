import { useState, useEffect, type SyntheticEvent } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { fetcher, apiCall } from "../api";
import { useAuth } from "../AuthContext";
import { Edit2, MapPin, Mail, AlertCircle, Save, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Profile() {
  const { userId, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const {
    data: profile,
    error,
    isLoading,
    mutate,
  } = useSWR(userId && isAuthenticated ? `/users/${userId}` : null, fetcher);

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

  return (
    <div className="main-content container" style={{ paddingTop: "120px", maxWidth: "800px" }}>
      <motion.div
        className="card"
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
    </div>
  );
}

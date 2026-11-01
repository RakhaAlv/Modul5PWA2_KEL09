import { useState } from 'react'
import {
  Shield, Copy, Check, Heart, FileText, Camera, Play, Pencil, Trash2, FilePlus,
} from 'lucide-react'
import userService from '../services/userService'
import { useFavorites } from '../hooks/useFavorites'
import {
  getAllDraftIds, getDraftTimestamp, formatDraftTime, deleteDraft,
} from '../utils/draftStorage'

/**
 * ProfilePage — User identity and Armory settings.
 * Hosts: operator card & stats, saved drafts, "About" and "Contact"
 * (moved here from their own nav tabs), and a link to the dedicated
 * Edit Profile page.
 */
export default function ProfilePage({ onReplaySplash, onEditProfile, onResumeDraft }) {
  const [profile, setProfile] = useState(() => userService.getUserProfile())
  const [copied, setCopied] = useState(false)

  const { favorites } = useFavorites()
  const [draftIds, setDraftIds] = useState(getAllDraftIds)

  const handleCopyId = () => {
    if (profile.userId) {
      navigator.clipboard.writeText(profile.userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target.result
      userService.updateAvatar(base64)
      setProfile((p) => ({ ...p, avatar: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleDiscardDraft = (id) => {
    deleteDraft(id)
    setDraftIds(getAllDraftIds())
  }

  return (
    <div className="profile-page">
      <section className="masthead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="display">Operator Profile</h1>
          <p className="lede">
            Operator credentials, procurement statistics, and armorer details.
          </p>
        </div>
        {onReplaySplash && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={onReplaySplash}
            title="Replay introductory splash animation"
          >
            <Play size={14} /> Replay Intro
          </button>
        )}
      </section>

      {/* Operator Card */}
      <div className="profile-card">
        <div className="profile-card-top">
          <div className="avatar-wrap">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.username} className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                <Shield size={36} stroke="var(--brass)" />
              </div>
            )}
            <label htmlFor="avatar-file-input" className="avatar-upload-btn" title="Upload avatar">
              <Camera size={14} />
              <input
                id="avatar-file-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden-file-input"
              />
            </label>
          </div>

          <div className="profile-identity">
            <h2 className="display">{profile.username || 'Shooter'}</h2>
            <div className="profile-id-row">
              <span className="mono-badge">{profile.userId}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={handleCopyId}
                title="Copy User ID to clipboard"
              >
                {copied ? <Check size={14} color="var(--brass)" /> : <Copy size={14} />}
              </button>
            </div>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          </div>

          {onEditProfile && (
            <button type="button" className="btn btn--outline btn--sm" onClick={onEditProfile}>
              <Pencil size={14} /> Edit Profile
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="profile-stats">
          <div className="stat-item">
            <Heart size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{favorites.length}</div>
            <div className="stat-label">Procurement Favorites</div>
          </div>
          <div className="stat-item">
            <FileText size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{draftIds.length}</div>
            <div className="stat-label">Saved Offline Drafts</div>
          </div>
        </div>
      </div>

      {/* Drafts section */}
      <section className="profile-section">
        <h3 className="section-title">Saved Drafts</h3>
        {draftIds.length === 0 ? (
          <p className="lede">No drafts saved yet. Drafts auto-save while you're creating or editing hardware.</p>
        ) : (
          <ul className="draft-list">
            {draftIds.map((id) => {
              const ts = getDraftTimestamp(id)
              return (
                <li key={id} className="draft-item">
                  <FilePlus size={16} stroke="var(--steel)" />
                  <div className="draft-item-info">
                    <span className="draft-item-title">
                      {id === 'create' ? 'New hardware draft' : `Edit draft — #${id}`}
                    </span>
                    <span className="draft-item-sub">{formatDraftTime(ts)}</span>
                  </div>
                  <div className="draft-item-actions">
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => onResumeDraft && onResumeDraft(id)}
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-ghost"
                      onClick={() => handleDiscardDraft(id)}
                      title="Discard draft"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* About section (moved from the top-level About tab) */}
      <section className="profile-section">
        <h3 className="section-title">About</h3>
        <h1 className="display" style={{ fontSize: '1.4rem' }}>A one-room armory.</h1>
        <p className="lede">
          Bore &amp; Barrel sells a short, honest list of firearms. Each piece is priced
          from the bench — no markup theatre, no filler.
        </p>
      </section>

      {/* Contact section (moved from the top-level Contact tab) */}
      <section className="profile-section">
        <h3 className="section-title">Contact</h3>
        <h1 className="display" style={{ fontSize: '1.4rem' }}>Come by the shop.</h1>
        <p className="lede">
          123 Range Road. Open Tuesday to Saturday, 10 to 6. Call (555) 010-0100.
        </p>
      </section>
    </div>
  )
}

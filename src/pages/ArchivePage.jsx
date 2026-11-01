import { useState } from 'react'
import { Archive, RotateCcw, Trash2, PackageOpen } from 'lucide-react'
import { getArchivedGuns, restoreGun, permanentlyDeleteArchived } from '../utils/archiveStorage'
import ConfirmModal from '../components/modals/ConfirmModal'
import { formatPrice } from '../utils/helpers'
import gunService from '../services/gunService'

export default function ArchivePage({ onBack, onRestored }) {
  const [archived, setArchived] = useState(() => getArchivedGuns())
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const handleRestore = async (gun) => {
    const restored = restoreGun(gun.id)
    if (restored) {
      // Try to re-create on server
      try {
        await gunService.createGun(restored)
      } catch {
        // If server fails, that's OK — it was a soft delete anyway
      }
      setArchived(getArchivedGuns())
      if (onRestored) onRestored()
    }
  }

  const handlePermanentDelete = () => {
    if (!deleteTarget) return
    setDeleting(true)
    permanentlyDeleteArchived(deleteTarget.id)
    setArchived(getArchivedGuns())
    setDeleteTarget(null)
    setDeleting(false)
  }

  return (
    <div className="form-page">
      <button type="button" className="detail-back" onClick={onBack}>
        ← Back to Catalog
      </button>

      <div className="form-title-group">
        <h1 className="display">Archived Items</h1>
        <p className="lede">
          Soft-deleted items are stored here. You can restore them or permanently remove them.
        </p>
      </div>

      {archived.length === 0 ? (
        <div className="state-box">
          <PackageOpen size={36} stroke="var(--steel)" />
          <h3>No archived items</h3>
          <p className="lede">Items you soft-delete will appear here for recovery.</p>
        </div>
      ) : (
        <ul className="archive-list">
          {archived.map((gun) => (
            <li key={gun.id || gun.name} className="archive-item">
              <img
                src={gun.image_url || gun.image || '/guns/pistol.svg'}
                alt={gun.name}
                className="archive-item-img"
                loading="lazy"
              />
              <div className="archive-item-info">
                <span className="archive-item-name">{gun.name}</span>
                <span className="archive-item-meta">
                  {gun.type || gun.category || 'Hardware'} · {formatPrice(gun.price || 0)}
                </span>
                <span className="archive-item-time">
                  Archived: {new Date(gun.archivedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="archive-item-actions">
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => handleRestore(gun)}
                  title="Restore to catalog"
                >
                  <RotateCcw size={14} /> Restore
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => setDeleteTarget(gun)}
                  title="Permanently delete"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Permanently Delete"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete Forever"
        danger
        loading={deleting}
        onConfirm={handlePermanentDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

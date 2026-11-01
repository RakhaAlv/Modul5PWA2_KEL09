import { useState, useMemo, useEffect } from 'react'
import { RefreshCw, Plus, Loader, AlertCircle, PackageOpen, Archive, ChevronLeft, ChevronRight } from 'lucide-react'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import GunDetail from '../components/gun/GunDetail'
import AdvancedFilter from '../components/common/AdvancedFilter'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'

const PAGE_SIZE = 8

/**
 * Catalog page — the main product listing.
 *
 * Data source priority:
 *   1. Live API via useGuns() — search / category / sort are resolved
 *      server-side so pagination totals stay correct.
 *   2. Local static array (GUNS_LOCAL) when the API is unreachable.
 *
 * Features: search, category filter, sort, pagination, soft-delete
 * (archive/restore), CRUD actions, detail view.
 */
export default function Catalog({ onNavigate, initialProductId }) {
  // ---- filters / sort / pagination ----
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [showArchived, setShowArchived] = useState(false)

  // Reset to page 1 whenever a filter changes
  useEffect(() => { setPage(1) }, [search, activeCategory, sortKey, sortOrder, showArchived])

  const queryParams = useMemo(() => ({
    search: search || undefined,
    category: activeCategory,
    sort_by: sortKey,
    order: sortOrder,
    page,
    limit: PAGE_SIZE,
    archived: showArchived,
  }), [search, activeCategory, sortKey, sortOrder, page, showArchived])

  // ---- API data ----
  const { guns: apiGuns, loading, error, pagination, refetch } = useGuns(queryParams)
  const [useLocal, setUseLocal] = useState(false)

  // Decide data source
  const guns = useMemo(() => {
    if (useLocal || (error && apiGuns.length === 0 && !showArchived)) {
      return GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id || `local-${i}` }))
    }
    return apiGuns
  }, [apiGuns, error, useLocal, showArchived])

  // ---- categories (independent of current page) ----
  const [categories, setCategories] = useState(['All'])
  useEffect(() => {
    let cancelled = false
    gunService.getCategories().then((cats) => {
      if (!cancelled) setCategories(cats)
    })
    return () => { cancelled = true }
  }, [])

  // ---- detail view ----
  const [selectedGun, setSelectedGun] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Open a shared product link (?product=ID) directly in detail view.
  useEffect(() => {
    if (!initialProductId) return
    let cancelled = false
    setDetailLoading(true)
    gunService.getGunById(initialProductId)
      .then((res) => { if (!cancelled && res.success) setSelectedGun(res.data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId])

  // ---- archive / restore / delete ----
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const handleArchive = async () => {
    if (!archiveTarget) return
    try {
      setBusy(true)
      setActionError('')
      await gunService.archiveGun(archiveTarget.id)
      setArchiveTarget(null)
      setSelectedGun(null)
      refetch()
    } catch (err) {
      setActionError(err.message || 'Failed to archive.')
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (gun) => {
    try {
      await gunService.restoreGun(gun.id)
      setSelectedGun(null)
      refetch()
    } catch (err) {
      setActionError(err.message || 'Failed to restore.')
    }
  }

  const handleDeletePermanent = async () => {
    if (!deleteTarget) return
    try {
      setBusy(true)
      setActionError('')
      await gunService.deleteGun(deleteTarget.id)
      setDeleteTarget(null)
      setSelectedGun(null)
      refetch()
    } catch (err) {
      setActionError(err.message || 'Failed to delete.')
    } finally {
      setBusy(false)
    }
  }

  // ---- If viewing a single product detail ----
  if (detailLoading) {
    return (
      <div className="state-box">
        <Loader size={28} className="spin" />
        <p>Loading product…</p>
      </div>
    )
  }

  if (selectedGun) {
    return (
      <>
        <GunDetail
          gun={selectedGun}
          archived={showArchived}
          onBack={() => setSelectedGun(null)}
          onEdit={onNavigate ? (g) => onNavigate('Edit', g) : undefined}
          onArchive={(g) => setArchiveTarget(g)}
          onRestore={showArchived ? handleRestore : undefined}
          onDeletePermanent={showArchived ? (g) => setDeleteTarget(g) : undefined}
        />
        <ConfirmModal
          open={!!archiveTarget}
          title="Archive Product"
          message={`Archive "${archiveTarget?.name}"? It will be hidden from the catalog but can be restored later.`}
          confirmLabel="Archive"
          danger
          loading={busy}
          onConfirm={handleArchive}
          onCancel={() => { setArchiveTarget(null); setActionError('') }}
        />
        <ConfirmModal
          open={!!deleteTarget}
          title="Delete Permanently"
          message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
          confirmLabel="Delete Forever"
          danger
          loading={busy}
          onConfirm={handleDeletePermanent}
          onCancel={() => { setDeleteTarget(null); setActionError('') }}
        />
        {actionError && <div className="toast toast--error">{actionError}</div>}
      </>
    )
  }

  const totalPages = pagination?.totalPages || 1

  // ---- Main catalog view ----
  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed
          with its type, caliber, and price — nothing else.
        </p>
      </section>

      <section>
        <div className="list-head">
          <h2>{showArchived ? 'Archived stock' : 'Current stock'}</h2>
          <div className="list-head-right">
            <span className="count">
              {pagination?.total ?? guns.length} piece{(pagination?.total ?? guns.length) !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              className={`btn btn--outline btn--sm${showArchived ? ' pill--active' : ''}`}
              onClick={() => setShowArchived((v) => !v)}
              title="Toggle archived items"
            >
              <Archive size={15} /> {showArchived ? 'View Active' : 'View Archived'}
            </button>
            {!showArchived && onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <AdvancedFilter
          search={search}
          onSearch={setSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={setActiveCategory}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={({ key, order }) => { setSortKey(key); setSortOrder(order) }}
        />

        {/* States */}
        {loading && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products…</p>
          </div>
        )}

        {!loading && error && !useLocal && !showArchived && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={refetch}>
                <RefreshCw size={16} /> Retry
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setUseLocal(true)}
              >
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {!loading && guns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>{showArchived ? 'No archived products.' : 'No products match your search.'}</p>
          </div>
        )}

        {/* Product grid */}
        {guns.length > 0 && (
          <ul className="stock">
            {guns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                archived={showArchived}
                onSelect={setSelectedGun}
                onEdit={!showArchived && onNavigate ? (g) => onNavigate('Edit', g) : undefined}
                onArchive={!showArchived ? (g) => setArchiveTarget(g) : undefined}
                onRestore={showArchived ? handleRestore : undefined}
                onDeletePermanent={showArchived ? (g) => setDeleteTarget(g) : undefined}
              />
            ))}
          </ul>
        )}

        {/* Pagination */}
        {!useLocal && guns.length > 0 && totalPages > 1 && (
          <div className="pagination">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="pagination__label">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}

        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => { setUseLocal(false); refetch() }}
            >
              Retry server
            </button>
          </p>
        )}
      </section>

      {/* Archive confirmation */}
      <ConfirmModal
        open={!!archiveTarget}
        title="Archive Product"
        message={`Archive "${archiveTarget?.name}"? It will be hidden from the catalog but can be restored later.`}
        confirmLabel="Archive"
        danger
        loading={busy}
        onConfirm={handleArchive}
        onCancel={() => { setArchiveTarget(null); setActionError('') }}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Permanently"
        message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete Forever"
        danger
        loading={busy}
        onConfirm={handleDeletePermanent}
        onCancel={() => { setDeleteTarget(null); setActionError('') }}
      />
      {actionError && (
        <div className="toast toast--error">{actionError}</div>
      )}
    </>
  )
}

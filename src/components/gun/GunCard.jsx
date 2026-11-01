import { ArchiveRestore, Trash2, ShoppingCart } from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import { useCart } from '../../hooks/useCart'
import { formatPrice, truncate } from '../../utils/helpers'

/**
 * Product card used in the catalog grid.
 *
 * @param {Object}   props
 * @param {Object}   props.gun               — product data
 * @param {Function} props.onSelect          — called with the gun when clicked
 * @param {Function} [props.onEdit]          — called when Edit is clicked (admin)
 * @param {Function} [props.onArchive]       — called when Archive (soft delete) is clicked
 * @param {Function} [props.onRestore]       — called when Restore is clicked (archived mode)
 * @param {Function} [props.onDeletePermanent] — called when Delete Permanently is clicked (archived mode)
 * @param {boolean}  [props.archived]        — render in "archived" mode
 */
export default function GunCard({
  gun,
  onSelect,
  onEdit,
  onArchive,
  onRestore,
  onDeletePermanent,
  archived = false,
}) {
  const imgSrc = gun.image_url || gun.image || '/guns/pistol.svg'
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0
  const { addToCart } = useCart()

  return (
    <li className={`card${archived ? ' card--archived' : ''}`}>
      <button
        type="button"
        className="card-btn"
        onClick={() => onSelect(gun)}
        aria-label={`View ${gun.name}`}
      >
        <img
          className="card-img"
          src={imgSrc}
          alt={gun.name}
          width="240"
          height="180"
          loading="lazy"
        />

        <span className="name display">{gun.name}</span>

        <span className="type">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>

        {gun.description && (
          <span className="card-desc">{truncate(gun.description, 72)}</span>
        )}

        <span className="price">{formatPrice(price)}</span>
      </button>

      {/* Floating actions row */}
      <div className="card-actions">
        {!archived && <FavoriteButton gunId={gun.id || gun.name} />}

        {!archived && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); addToCart(gun) }}
            aria-label={`Add ${gun.name} to cart`}
            title="Add to cart"
          >
            <ShoppingCart size={16} />
          </button>
        )}

        {!archived && onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onEdit(gun) }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            ✏️
          </button>
        )}

        {!archived && onArchive && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => { e.stopPropagation(); onArchive(gun) }}
            aria-label={`Archive ${gun.name}`}
            title="Archive"
          >
            🗃️
          </button>
        )}

        {archived && onRestore && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onRestore(gun) }}
            aria-label={`Restore ${gun.name}`}
            title="Restore"
          >
            <ArchiveRestore size={16} />
          </button>
        )}

        {archived && onDeletePermanent && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => { e.stopPropagation(); onDeletePermanent(gun) }}
            aria-label={`Delete ${gun.name} permanently`}
            title="Delete permanently"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </li>
  )
}

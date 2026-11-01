import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ArrowLeft, Star, Send, Loader, Share2, Check, MessageCircle,
  ThumbsUp, ThumbsDown, Pencil, Trash2, ArchiveRestore, X, ShoppingCart,
} from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import { useCart } from '../../hooks/useCart'
import { useReviews, useCreateReview } from '../../hooks/useReviews'
import { getUserIdentifier } from '../../services/userService'
import { formatPrice, averageRating } from '../../utils/helpers'
import reviewService from '../../services/reviewService'
import productImageService from '../../services/productImageService'

// Seller WhatsApp number (international format, no leading +/0).
const SELLER_WHATSAPP = '6285717369022'

/**
 * Build a shareable, unique link to a single product.
 */
export const buildShareUrl = (gunId) => {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('product', gunId)
  return url.toString()
}

/**
 * Full-screen product detail view.
 *
 * @param {Object}   props
 * @param {Object}   props.gun                 — product data
 * @param {Function} props.onBack              — return to catalog
 * @param {Function} [props.onEdit]            — navigate to edit page
 * @param {Function} [props.onArchive]         — soft-delete (archive) this product
 * @param {Function} [props.onRestore]         — restore an archived product
 * @param {Function} [props.onDeletePermanent] — permanently delete an archived product
 * @param {boolean}  [props.archived]          — this product is currently archived
 */
export default function GunDetail({
  gun, onBack, onEdit, onArchive, onRestore, onDeletePermanent, archived = false,
}) {
  const imgSrc = gun.image_url || gun.image || '/guns/pistol.svg'
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0
  const myUserId = getUserIdentifier()
  const { addToCart } = useCart()
  const [addedToCart, setAddedToCart] = useState(false)
  const handleAddToCart = () => {
    addToCart(gun)
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  // ---- Share ----
  const [shareCopied, setShareCopied] = useState(false)
  const handleShare = async () => {
    const shareUrl = buildShareUrl(gun.id)
    if (navigator.share) {
      try {
        await navigator.share({ title: gun.name, url: shareUrl })
        return
      } catch {
        /* user cancelled the native share sheet — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', shareUrl)
    }
  }

  // ---- WhatsApp contact ----
  const waHref = `https://wa.me/${SELLER_WHATSAPP}?text=${encodeURIComponent(
    `Hi, I'm interested in "${gun.name}" (${formatPrice(price)}). Is it still available?\n${buildShareUrl(gun.id)}`,
  )}`

  // ---- Gallery (multiple images) ----
  const [gallery, setGallery] = useState([])
  useEffect(() => {
    let cancelled = false
    if (!gun.id || String(gun.id).startsWith('local-')) return undefined
    productImageService.getImages(gun.id).then((res) => {
      if (!cancelled && res.success) setGallery(res.data)
    })
    return () => { cancelled = true }
  }, [gun.id])

  const images = useMemo(() => {
    const extra = gallery.map((g) => g.image_url)
    return [imgSrc, ...extra.filter((u) => u && u !== imgSrc)]
  }, [gallery, imgSrc])
  const [activeImage, setActiveImage] = useState(0)
  useEffect(() => setActiveImage(0), [gun.id])

  // ---- Reviews ----
  const { reviews, loading: reviewsLoading, refetch: refetchReviews } = useReviews(gun.id)
  const { createReview, loading: submitting } = useCreateReview()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  // Editing an existing review
  const [editingId, setEditingId] = useState(null)
  const [editRating, setEditRating] = useState(5)
  const [editComment, setEditComment] = useState('')
  const [reviewBusyId, setReviewBusyId] = useState(null)

  // Votes { [reviewId]: { up, down, mine: 1|-1|null } }
  const [votes, setVotes] = useState({})

  const loadVotes = useCallback(async (list) => {
    const ids = list.map((r) => r.id).filter(Boolean)
    if (ids.length === 0) {
      setVotes({})
      return
    }
    const res = await reviewService.getVotesForReviews(ids)
    const tally = {}
    ids.forEach((id) => { tally[id] = { up: 0, down: 0, mine: null } })
    if (res.success) {
      res.data.forEach((v) => {
        const bucket = tally[v.review_id] || (tally[v.review_id] = { up: 0, down: 0, mine: null })
        if (v.vote === 1) bucket.up += 1
        else if (v.vote === -1) bucket.down += 1
        if (String(v.user_id) === String(myUserId)) bucket.mine = v.vote
      })
    }
    setVotes(tally)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId])

  useEffect(() => {
    if (!reviewsLoading) loadVotes(reviews)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews, reviewsLoading])

  const avgRating = gun.average_rating || averageRating(reviews)
  const reviewCount = gun.review_count ?? reviews.length

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')

    if (rating < 1 || rating > 5) {
      setReviewError('Rating must be between 1 and 5.')
      return
    }

    const result = await createReview(gun.id, {
      user_identifier: myUserId,
      rating,
      comment: comment.trim(),
    })

    if (result) {
      setReviewSuccess('Review submitted!')
      setComment('')
      setRating(5)
      refetchReviews()
    } else {
      setReviewError('Could not submit review. The server may be unavailable.')
    }
  }

  const startEdit = (rev) => {
    setEditingId(rev.id)
    setEditRating(rev.rating)
    setEditComment(rev.comment || '')
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (reviewId) => {
    setReviewBusyId(reviewId)
    try {
      await reviewService.updateReview(reviewId, { rating: editRating, comment: editComment.trim() })
      setEditingId(null)
      refetchReviews()
    } catch (err) {
      setReviewError(err.message || 'Failed to update review.')
    } finally {
      setReviewBusyId(null)
    }
  }

  const removeReview = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return
    setReviewBusyId(reviewId)
    try {
      await reviewService.deleteReview(reviewId)
      refetchReviews()
    } catch (err) {
      setReviewError(err.message || 'Failed to delete review.')
    } finally {
      setReviewBusyId(null)
    }
  }

  const castVote = async (reviewId, vote) => {
    try {
      await reviewService.voteReview(reviewId, myUserId, vote)
      loadVotes(reviews)
    } catch {
      /* best-effort — ignore vote failures */
    }
  }

  return (
    <div className="detail">
      {/* Back button */}
      <button type="button" className="detail-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      {archived && (
        <div className="toast toast--error" style={{ marginBottom: 12 }}>
          This item is archived. It is hidden from the public catalog.
        </div>
      )}

      {/* Hero */}
      <div className="detail-hero">
        <div>
          <img className="detail-img" src={images[activeImage] || imgSrc} alt={gun.name} />
          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  className={`gallery-thumb${i === activeImage ? ' gallery-thumb--active' : ''}`}
                  onClick={() => setActiveImage(i)}
                >
                  <img src={src} alt={`${gun.name} ${i + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-info">
          <h1 className="display">{gun.name}</h1>
          <p className="type">
            {category}
            {caliber ? ` · ${caliber}` : ''}
          </p>
          <p className="price detail-price">{formatPrice(price)}</p>

          {avgRating > 0 && (
            <p className="detail-rating">
              <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
              {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
            </p>
          )}

          <div className="detail-actions">
            {!archived && <FavoriteButton gunId={gun.id || gun.name} />}

            {!archived && (
              <button type="button" className="btn btn--primary" onClick={handleAddToCart}>
                {addedToCart ? <Check size={16} /> : <ShoppingCart size={16} />}
                {addedToCart ? 'Added' : 'Add to Cart'}
              </button>
            )}

            <button type="button" className="btn btn--outline" onClick={handleShare}>
              {shareCopied ? <Check size={16} /> : <Share2 size={16} />}
              {shareCopied ? 'Link copied' : 'Share'}
            </button>

            <a
              className="btn btn--outline"
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={16} /> Contact Seller
            </a>

            {!archived && onEdit && (
              <button type="button" className="btn btn--outline" onClick={() => onEdit(gun)}>
                Edit
              </button>
            )}
            {!archived && onArchive && (
              <button type="button" className="btn btn--danger" onClick={() => onArchive(gun)}>
                Archive
              </button>
            )}
            {archived && onRestore && (
              <button type="button" className="btn btn--outline" onClick={() => onRestore(gun)}>
                <ArchiveRestore size={16} /> Restore
              </button>
            )}
            {archived && onDeletePermanent && (
              <button type="button" className="btn btn--danger" onClick={() => onDeletePermanent(gun)}>
                <Trash2 size={16} /> Delete Permanently
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <section className="detail-section">
        <h2>Description</h2>
        <p>{gun.description || 'No description available.'}</p>
      </section>

      {/* Specifications (from ingredients / steps if present) */}
      {gun.ingredients && gun.ingredients.length > 0 && (
        <section className="detail-section">
          <h2>Specifications</h2>
          <ul className="detail-specs">
            {gun.ingredients.map((ing, i) => (
              <li key={ing.id || i}>
                <strong>{ing.name}</strong> — {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {gun.steps && gun.steps.length > 0 && (
        <section className="detail-section">
          <h2>Assembly / Maintenance Steps</h2>
          <ol className="detail-steps">
            {gun.steps.map((step, i) => (
              <li key={step.id || i}>
                {step.instruction || step}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Reviews Section */}
      <section className="detail-section">
        <h2>Reviews</h2>

        {/* Submit review */}
        <form className="review-form" onSubmit={handleSubmitReview}>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={22}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
          </div>

          <textarea
            className="review-input"
            rows="3"
            placeholder="Write a short review (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />

          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || !gun.id}
          >
            {submitting ? (
              <><Loader size={16} className="spin" /> Submitting…</>
            ) : (
              <><Send size={16} /> Submit Review</>
            )}
          </button>

          {reviewError && <p className="form-error">{reviewError}</p>}
          {reviewSuccess && <p className="form-success">{reviewSuccess}</p>}
          {!gun.id && (
            <p className="form-hint">
              Reviews require a server-generated product ID. This product is local-only.
            </p>
          )}
        </form>

        {/* Existing reviews */}
        {reviewsLoading ? (
          <p className="detail-loading">Loading reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list">
            {reviews.map((rev) => {
              const isMine = rev.user_id && String(rev.user_id) === String(myUserId)
              const tally = votes[rev.id] || { up: 0, down: 0, mine: null }
              const isEditing = editingId === rev.id
              const busy = reviewBusyId === rev.id

              return (
                <li key={rev.id} className="review-item">
                  <div className="review-head">
                    <span className="review-user">{rev.user_identifier || 'Anonymous'}</span>
                    {!isEditing && (
                      <span className="review-stars-display">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            size={14}
                            fill={i < rev.rating ? 'var(--brass)' : 'none'}
                            stroke={i < rev.rating ? 'var(--brass)' : 'var(--line)'}
                          />
                        ))}
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="review-edit-box">
                      <div className="review-stars">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="star-btn"
                            onClick={() => setEditRating(n)}
                          >
                            <Star
                              size={18}
                              fill={n <= editRating ? 'var(--brass)' : 'none'}
                              stroke={n <= editRating ? 'var(--brass)' : 'var(--steel)'}
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="review-input"
                        rows="2"
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        maxLength={500}
                      />
                      <div className="review-edit-actions">
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => saveEdit(rev.id)}
                          disabled={busy}
                        >
                          {busy ? <Loader size={14} className="spin" /> : 'Save'}
                        </button>
                        <button type="button" className="btn btn--outline btn--sm" onClick={cancelEdit}>
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    rev.comment && <p className="review-comment">{rev.comment}</p>
                  )}

                  <div className="review-footer">
                    <div className="review-votes">
                      <button
                        type="button"
                        className={`vote-btn${tally.mine === 1 ? ' vote-btn--active' : ''}`}
                        onClick={() => castVote(rev.id, 1)}
                        aria-label="Thumbs up"
                      >
                        <ThumbsUp size={14} /> {tally.up}
                      </button>
                      <button
                        type="button"
                        className={`vote-btn${tally.mine === -1 ? ' vote-btn--active' : ''}`}
                        onClick={() => castVote(rev.id, -1)}
                        aria-label="Thumbs down"
                      >
                        <ThumbsDown size={14} /> {tally.down}
                      </button>
                    </div>

                    {isMine && !isEditing && (
                      <div className="review-owner-actions">
                        <button type="button" className="icon-btn" onClick={() => startEdit(rev)} title="Edit review">
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => removeReview(rev.id)}
                          title="Delete review"
                          disabled={busy}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="detail-empty">No reviews yet. Be the first!</p>
        )}
      </section>
    </div>
  )
}

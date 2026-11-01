import { apiClient, IS_SUPABASE } from '../config/api'

// ---------------------------------------------------------------------------
// ReviewService — product reviews & ratings, plus thumbs up/down votes on
// reviews (public.review_votes).
// Supports both Supabase (public.reviews) and university API (/api/v1/recipes/:id/reviews).
// ---------------------------------------------------------------------------

class ReviewService {
  /**
   * Fetch all reviews for a given product.
   */
  async getReviews(gunId) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(
        `/rest/v1/reviews?product_id=eq.${gunId}&select=*&order=created_at.desc`,
      )
      const list = Array.isArray(data)
        ? data.map((r) => ({
            id: r.id,
            product_id: r.product_id,
            user_id: r.user_id,
            user_identifier: r.user_id ? `Operator ${String(r.user_id).substring(0, 8)}` : 'Anonymous',
            rating: r.rating,
            comment: r.comment || '',
            created_at: r.created_at,
          }))
        : []

      return { success: true, data: list }
    }

    return apiClient.get(`/api/v1/recipes/${gunId}/reviews`)
  }

  /**
   * Submit a new review.
   * @param {string|number} gunId
   * @param {Object} reviewData  { user_identifier, rating, comment }
   */
  async createReview(gunId, reviewData) {
    if (IS_SUPABASE) {
      const payload = {
        product_id: Number(gunId),
        user_id: reviewData.user_id || reviewData.user_identifier,
        rating: Number(reviewData.rating),
        comment: reviewData.comment || '',
      }

      const res = await apiClient.post('/rest/v1/reviews', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      return { success: true, data: created }
    }

    return apiClient.post(`/api/v1/recipes/${gunId}/reviews`, reviewData)
  }

  /**
   * Edit an existing review.
   */
  async updateReview(reviewId, reviewData) {
    if (IS_SUPABASE) {
      const res = await apiClient.patch(
        `/rest/v1/reviews?id=eq.${reviewId}`,
        {
          rating: Number(reviewData.rating),
          comment: reviewData.comment,
        },
        { headers: { Prefer: 'return=representation' } },
      )
      return { success: true, data: Array.isArray(res) ? res[0] : res }
    }

    return apiClient.put(`/api/v1/reviews/${reviewId}`, reviewData)
  }

  /**
   * Delete a review.
   */
  async deleteReview(reviewId) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/reviews?id=eq.${reviewId}`)
      return { success: true }
    }

    return apiClient.delete(`/api/v1/reviews/${reviewId}`)
  }

  // -------------------------------------------------------------------------
  // Review votes (thumbs up / thumbs down)
  // -------------------------------------------------------------------------

  /**
   * Fetch all votes for a set of review ids, in one request.
   * @param {Array<string|number>} reviewIds
   * @returns {Promise<{success:boolean, data: Array<{review_id, user_id, vote}>}>}
   */
  async getVotesForReviews(reviewIds) {
    if (!IS_SUPABASE || !reviewIds || reviewIds.length === 0) {
      return { success: true, data: [] }
    }
    const idsList = reviewIds.join(',')
    const data = await apiClient.get(
      `/rest/v1/review_votes?review_id=in.(${idsList})&select=*`,
    )
    return { success: true, data: Array.isArray(data) ? data : [] }
  }

  /**
   * Cast or change this user's vote on a review. Passing the same vote again
   * removes it (toggle off).
   * @param {string|number} reviewId
   * @param {string} userId
   * @param {1|-1} vote
   */
  async voteReview(reviewId, userId, vote) {
    if (!IS_SUPABASE) return { success: true, data: null }

    const existing = await apiClient.get(
      `/rest/v1/review_votes?review_id=eq.${reviewId}&user_id=eq.${userId}&select=*`,
    )

    const current = Array.isArray(existing) && existing.length > 0 ? existing[0] : null

    if (current && current.vote === vote) {
      // Same vote clicked again — remove it.
      await apiClient.delete(
        `/rest/v1/review_votes?review_id=eq.${reviewId}&user_id=eq.${userId}`,
      )
      return { success: true, data: { vote: null } }
    }

    if (current) {
      // Switch vote direction.
      await apiClient.patch(
        `/rest/v1/review_votes?review_id=eq.${reviewId}&user_id=eq.${userId}`,
        { vote },
      )
      return { success: true, data: { vote } }
    }

    await apiClient.post(
      '/rest/v1/review_votes',
      { review_id: Number(reviewId), user_id: userId, vote },
      { headers: { Prefer: 'return=minimal' } },
    )
    return { success: true, data: { vote } }
  }
}

export default new ReviewService()

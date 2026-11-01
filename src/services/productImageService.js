import { apiClient, IS_SUPABASE } from '../config/api'

// ---------------------------------------------------------------------------
// ProductImageService — extra gallery images for a product
// (public.product_images). A product can have more than one image: the
// primary `image_url` on the product row, plus any rows here.
// ---------------------------------------------------------------------------

class ProductImageService {
  /**
   * Fetch extra gallery images for a product, ordered.
   */
  async getImages(productId) {
    if (!productId) return { success: true, data: [] }

    if (IS_SUPABASE) {
      const data = await apiClient.get(
        `/rest/v1/product_images?product_id=eq.${productId}&select=*&order=sort_order.asc`,
      )
      return { success: true, data: Array.isArray(data) ? data : [] }
    }
    return { success: true, data: [] }
  }

  /**
   * Add one or more image URLs to a product's gallery.
   * @param {string|number} productId
   * @param {string[]} urls
   */
  async addImages(productId, urls = []) {
    if (!productId || urls.length === 0) return { success: true, data: [] }

    if (IS_SUPABASE) {
      const payload = urls.map((url, idx) => ({
        product_id: Number(productId),
        image_url: url,
        sort_order: idx,
      }))
      const res = await apiClient.post('/rest/v1/product_images', payload, {
        headers: { Prefer: 'return=representation' },
      })
      return { success: true, data: Array.isArray(res) ? res : [res] }
    }
    return { success: true, data: [] }
  }

  /**
   * Remove a single gallery image.
   */
  async deleteImage(imageId) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/product_images?id=eq.${imageId}`)
      return { success: true }
    }
    return { success: true }
  }
}

export default new ProductImageService()

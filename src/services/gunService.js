import { apiClient, apiRaw, IS_SUPABASE } from '../config/api'

// ---------------------------------------------------------------------------
// Normalizer — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  // Resolve specifications from Supabase `specs` (text array) or API `ingredients`
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs.map((s, idx) => {
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          return {
            id: `spec-${idx}`,
            name: s.substring(0, colonIndex).trim(),
            quantity: s.substring(colonIndex + 1).trim(),
          }
        }
        return {
          id: `spec-${idx}`,
          name: 'Specification',
          quantity: s.trim(),
        }
      }
      return s
    })
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : ['Verify firearm is completely unloaded and point in safe direction.', 'Inspect receiver and mechanism for maintenance.']

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: item.image_url || item.image || '/guns/pistol.svg',
    image: item.image_url || item.image || '/guns/pistol.svg',
    archived: Boolean(item.archived),
    ingredients: specsList,
    steps: stepsList,
  }
}

// ---------------------------------------------------------------------------
// Query cache — small in-memory TTL cache so repeated reads (pagination,
// re-visiting the catalog, re-opening a product) don't always hit the
// network. Cleared automatically whenever data is mutated.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 30 * 1000
const cache = new Map()

const cacheGet = (key) => {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.time > CACHE_TTL_MS) {
    cache.delete(key)
    return undefined
  }
  return hit.value
}

const cacheSet = (key, value) => {
  cache.set(key, { value, time: Date.now() })
}

const clearCache = () => cache.clear()

// ---------------------------------------------------------------------------
// GunService — wraps backend CRUD endpoints.
// Supports both Supabase PostgREST table (/rest/v1/products) and
// standard REST API (/api/v1/recipes).
// ---------------------------------------------------------------------------
class GunService {
  /**
   * Fetch a paginated, filterable list of products.
   * @param {Object} params
   * @param {string}  [params.search]
   * @param {string}  [params.category]   — 'All' or a product type
   * @param {string}  [params.sort_by]    — 'name' | 'price' | 'created_at'
   * @param {string}  [params.order]      — 'asc' | 'desc'
   * @param {number}  [params.page=1]
   * @param {number}  [params.limit=50]
   * @param {boolean} [params.archived=false] — fetch archived (soft-deleted) items instead
   */
  async getGuns(params = {}) {
    const cacheKey = `getGuns:${JSON.stringify(params)}`
    const cached = cacheGet(cacheKey)
    if (cached) return cached

    if (IS_SUPABASE) {
      const page = Number(params.page) > 0 ? Number(params.page) : 1
      const limit = Number(params.limit) > 0 ? Number(params.limit) : 50
      const offset = (page - 1) * limit

      const queryParts = ['select=*']

      queryParts.push(`archived=eq.${params.archived ? 'true' : 'false'}`)

      if (params.search) {
        queryParts.push(`name=ilike.*${encodeURIComponent(params.search)}*`)
      }

      if (params.category && params.category !== 'All') {
        queryParts.push(`type=eq.${encodeURIComponent(params.category)}`)
      }

      if (params.sort_by) {
        const order = params.order === 'desc' ? 'desc' : 'asc'
        queryParts.push(`order=${encodeURIComponent(params.sort_by)}.${order}`)
      } else {
        queryParts.push('order=created_at.desc')
      }

      queryParts.push(`limit=${limit}`)
      queryParts.push(`offset=${offset}`)

      const queryString = queryParts.join('&')

      const res = await apiRaw.get(`/rest/v1/products?${queryString}`, {
        headers: { Prefer: 'count=exact' },
      })

      const data = res.data
      const list = Array.isArray(data) ? data.map(normalizeProduct) : []

      // PostgREST returns e.g. "Content-Range: 0-11/42"
      const contentRange = res.headers?.['content-range']
      const total = contentRange
        ? Number(contentRange.split('/')[1]) || list.length
        : list.length

      const result = {
        success: true,
        data: list,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      }
      cacheSet(cacheKey, result)
      return result
    }

    // Fallback: university REST API
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    const result = await apiClient.get('/api/v1/recipes', { params: clean })
    cacheSet(cacheKey, result)
    return result
  }

  /**
   * Fetch the distinct list of product types/categories, independent of the
   * current page — used to populate the category filter pills.
   */
  async getCategories() {
    const cacheKey = 'getCategories'
    const cached = cacheGet(cacheKey)
    if (cached) return cached

    if (IS_SUPABASE) {
      try {
        const data = await apiClient.get(
          '/rest/v1/products?select=type&archived=eq.false',
        )
        const set = new Set()
        if (Array.isArray(data)) {
          data.forEach((row) => {
            if (row.type) set.add(row.type)
          })
        }
        const categories = ['All', ...Array.from(set).sort()]
        cacheSet(cacheKey, categories)
        return categories
      } catch {
        return ['All']
      }
    }
    return ['All']
  }

  /**
   * Fetch a single product by ID.
   */
  async getGunById(id) {
    const cacheKey = `getGunById:${id}`
    const cached = cacheGet(cacheKey)
    if (cached) return cached

    let result
    if (IS_SUPABASE) {
      const data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      if (Array.isArray(data) && data.length > 0) {
        result = { success: true, data: normalizeProduct(data[0]) }
      } else {
        throw new Error('Hardware item not found.')
      }
    } else {
      result = await apiClient.get(`/api/v1/recipes/${id}`)
    }
    cacheSet(cacheKey, result)
    return result
  }

  /**
   * Create a new product.
   */
  async createGun(data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : []

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: data.image_url || null,
      }

      const res = await apiClient.post('/rest/v1/products', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      clearCache()
      return { success: true, data: normalizeProduct(created) }
    }
    const result = await apiClient.post('/api/v1/recipes', data)
    clearCache()
    return result
  }

  /**
   * Update existing product.
   */
  async updateGun(id, data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : undefined

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      if (data.description !== undefined) payload.description = data.description
      if (specsArray !== undefined) payload.specs = specsArray
      if (data.image_url !== undefined) payload.image_url = data.image_url
      if (data.archived !== undefined) payload.archived = Boolean(data.archived)

      const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, {
        headers: { Prefer: 'return=representation' },
      })
      const updated = Array.isArray(res) ? res[0] : res
      clearCache()
      return { success: true, data: normalizeProduct(updated) }
    }
    const result = await apiClient.put(`/api/v1/recipes/${id}`, data)
    clearCache()
    return result
  }

  /**
   * Partial update (PATCH).
   */
  async patchGun(id, data) {
    if (IS_SUPABASE) {
      return this.updateGun(id, data)
    }
    const result = await apiClient.patch(`/api/v1/recipes/${id}`, data)
    clearCache()
    return result
  }

  /**
   * Soft delete — flag the product as archived instead of removing it.
   * It disappears from the normal catalog but can be restored later.
   */
  async archiveGun(id) {
    return this.updateGun(id, { archived: true })
  }

  /**
   * Restore a previously archived product.
   */
  async restoreGun(id) {
    return this.updateGun(id, { archived: false })
  }

  /**
   * Permanently delete a product (and, via FK cascade, its reviews,
   * favorites, extra images and review votes).
   */
  async deleteGun(id) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      clearCache()
      return { success: true }
    }
    const result = await apiClient.delete(`/api/v1/recipes/${id}`)
    clearCache()
    return result
  }
}

export default new GunService()
export { clearCache as clearGunCache }

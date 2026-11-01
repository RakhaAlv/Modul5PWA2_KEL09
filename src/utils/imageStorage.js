const IMAGE_MAP_KEY = 'bore_barrel_gun_images'

/**
 * Retrieve extra images map from localStorage.
 * @returns {Record<string, string[]>}
 */
export const getAllStoredImages = () => {
  try {
    const raw = localStorage.getItem(IMAGE_MAP_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * Get images array for a specific gun ID.
 * @param {string|number} gunId
 * @returns {string[]}
 */
export const getStoredImages = (gunId) => {
  if (!gunId) return []
  const map = getAllStoredImages()
  const key = String(gunId)
  return Array.isArray(map[key]) ? map[key] : []
}

/**
 * Store images array for a specific gun ID.
 * @param {string|number} gunId
 * @param {string[]} images
 */
export const setStoredImages = (gunId, images) => {
  if (!gunId || !Array.isArray(images)) return
  try {
    const map = getAllStoredImages()
    map[String(gunId)] = images.filter(Boolean)
    localStorage.setItem(IMAGE_MAP_KEY, JSON.stringify(map))
  } catch (err) {
    console.warn('Failed to store gun images in localStorage:', err)
  }
}

/**
 * Normalize and extract all images for a gun object.
 * Checks item.images, JSON stringified image_url, delimiter |||,
 * and local storage overrides.
 *
 * @param {Object} item
 * @returns {string[]}
 */
export const parseGunImages = (item) => {
  if (!item) return ['/guns/pistol.svg']

  let list = []

  // 1. Direct array in item.images
  if (Array.isArray(item.images) && item.images.length > 0) {
    list.push(...item.images)
  }

  // 2. Parsed from image_url or image
  const rawUrl = item.image_url || item.image
  if (typeof rawUrl === 'string') {
    const trimmed = rawUrl.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          list.push(...parsed)
        }
      } catch {
        list.push(trimmed)
      }
    } else if (trimmed.includes('|||')) {
      const parts = trimmed.split('|||').map((s) => s.trim()).filter(Boolean)
      list.push(...parts)
    } else if (trimmed.length > 0) {
      list.push(trimmed)
    }
  }

  // 3. Merge with localStorage cache if item has an ID
  if (item.id) {
    const cached = getStoredImages(item.id)
    if (cached.length > 0) {
      list.push(...cached)
    }
  }

  // Deduplicate while preserving order
  const unique = Array.from(new Set(list.filter(Boolean)))

  return unique.length > 0 ? unique : ['/guns/pistol.svg']
}

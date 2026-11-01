const ARCHIVE_KEY = 'bore_barrel_archived_guns'

export const getArchivedGuns = () => {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const archiveGun = (gun) => {
  try {
    const archived = getArchivedGuns()
    const entry = {
      ...gun,
      archivedAt: new Date().toISOString(),
    }
    archived.push(entry)
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archived))
    return true
  } catch {
    return false
  }
}

export const restoreGun = (gunId) => {
  try {
    let archived = getArchivedGuns()
    const gun = archived.find((g) => String(g.id) === String(gunId))
    archived = archived.filter((g) => String(g.id) !== String(gunId))
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archived))
    return gun || null
  } catch {
    return null
  }
}

export const permanentlyDeleteArchived = (gunId) => {
  try {
    let archived = getArchivedGuns()
    archived = archived.filter((g) => String(g.id) !== String(gunId))
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archived))
    return true
  } catch {
    return false
  }
}

export const clearArchive = () => {
  try {
    localStorage.removeItem(ARCHIVE_KEY)
    return true
  } catch {
    return false
  }
}

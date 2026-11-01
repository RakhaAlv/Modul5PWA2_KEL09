import { useState, lazy, Suspense } from 'react'
import { Loader } from 'lucide-react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import PWABadge from './components/PWABadge.jsx'
import ConfirmModal from './components/modals/ConfirmModal.jsx'
import SplashScreen from './components/common/SplashScreen.jsx'
import gunService from './services/gunService'
import './App.css'

// ---------------------------------------------------------------------------
// Lazy-loaded pages — each page's code only downloads when the visitor
// actually navigates to it, instead of all being bundled into the initial
// load.
// ---------------------------------------------------------------------------
const Catalog = lazy(() => import('./pages/Catalog.jsx'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage.jsx'))
const CartPage = lazy(() => import('./pages/CartPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const EditProfilePage = lazy(() => import('./pages/EditProfilePage.jsx'))
const CreateGunPage = lazy(() => import('./pages/CreateGunPage.jsx'))
const EditGunPage = lazy(() => import('./pages/EditGunPage.jsx'))
const GunDetail = lazy(() => import('./components/gun/GunDetail.jsx'))

const PageFallback = () => (
  <div className="state-box">
    <Loader size={28} className="spin" />
    <p>Loading…</p>
  </div>
)

// If this app was opened from a shared product link (?product=123), read it
// once on startup so the catalog can jump straight into that product's
// detail view.
const getInitialProductId = () => {
  try {
    return new URLSearchParams(window.location.search).get('product') || null
  } catch {
    return null
  }
}

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [tab, setTab] = useState('Catalog')
  const [mode, setMode] = useState('list') // 'list' | 'create' | 'edit' | 'detail' | 'editProfile'
  const [selectedGun, setSelectedGun] = useState(null)
  const [editingGun, setEditingGun] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiving, setArchiving] = useState(false)
  const [initialProductId] = useState(getInitialProductId)

  // Unified navigation handler
  const handleNavigate = (target, payload) => {
    if (target === 'Create') {
      setMode('create')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Edit') {
      setEditingGun(payload)
      setMode('edit')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Detail') {
      setSelectedGun(payload)
      setMode('detail')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'EditProfile') {
      setMode('editProfile')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Tab change
      setTab(target)
      setMode('list')
      setSelectedGun(null)
      setEditingGun(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBackToList = () => {
    setMode('list')
    setSelectedGun(null)
    setEditingGun(null)
  }

  return (
    <div className="shell">
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      <Header
        tab={mode === 'list' ? tab : ''}
        onTab={(newTab) => handleNavigate(newTab)}
        onNavigateCreate={() => handleNavigate('Create')}
      />

      <main className="main">
        <Suspense fallback={<PageFallback />}>
          {/* Sub-page views */}
          {mode === 'create' && (
            <CreateGunPage
              onBack={handleBackToList}
              onSuccess={() => {
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {mode === 'edit' && (
            <EditGunPage
              gun={editingGun}
              gunId={editingGun?.id}
              onBack={handleBackToList}
              onSuccess={() => {
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {mode === 'editProfile' && (
            <EditProfilePage onBack={() => { setMode('list'); setTab('Profile') }} />
          )}

          {mode === 'detail' && selectedGun && (
            <GunDetail
              gun={selectedGun}
              onBack={handleBackToList}
              onEdit={(g) => handleNavigate('Edit', g)}
              onArchive={(g) => setArchiveTarget(g)}
            />
          )}

          {/* Top-level Tabs */}
          {mode === 'list' && (
            <>
              {tab === 'Catalog' && (
                <Catalog
                  initialProductId={initialProductId}
                  onNavigate={(destination, payload) => handleNavigate(destination, payload)}
                />
              )}
              {tab === 'Favorites' && (
                <FavoritesPage
                  onSelectGun={(g) => handleNavigate('Detail', g)}
                  onNavigateCatalog={() => setTab('Catalog')}
                />
              )}
              {tab === 'Cart' && (
                <CartPage onNavigateCatalog={() => setTab('Catalog')} />
              )}
              {tab === 'Profile' && (
                <ProfilePage
                  onReplaySplash={() => setShowSplash(true)}
                  onEditProfile={() => handleNavigate('EditProfile')}
                  onResumeDraft={(target) => {
                    if (target === 'create') {
                      handleNavigate('Create')
                    } else {
                      handleNavigate('Edit', { id: target })
                    }
                  }}
                />
              )}
            </>
          )}
        </Suspense>
      </main>

      {/* Global Archive (soft delete) Confirmation — used by the Favorites
          detail flow; Catalog manages its own archive/restore/delete modals. */}
      <ConfirmModal
        open={Boolean(archiveTarget)}
        title="Archive Hardware Record"
        message={`Archive "${archiveTarget?.name}"? It will be hidden from the catalog but can be restored later from Catalog → View Archived.`}
        confirmLabel="Archive"
        danger
        loading={archiving}
        onConfirm={async () => {
          if (!archiveTarget) return
          try {
            setArchiving(true)
            await gunService.archiveGun(archiveTarget.id)
            setArchiveTarget(null)
            handleBackToList()
            setTab('Catalog')
          } catch (err) {
            alert(err.message || 'Failed to archive record.')
          } finally {
            setArchiving(false)
          }
        }}
        onCancel={() => setArchiveTarget(null)}
      />

      <PWABadge />
      <Footer />
    </div>
  )
}

export default App

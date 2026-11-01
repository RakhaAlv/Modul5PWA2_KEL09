import axios from 'axios'

// ---------------------------------------------------------------------------
// Base URL & Supabase Key Configuration
// Read from environment variables (.env)
// ---------------------------------------------------------------------------
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''

const IS_SUPABASE =
  BASE_URL.includes('supabase.co') || Boolean(SUPABASE_KEY)

if (!BASE_URL) {
  console.warn(
    '[api] VITE_API_BASE_URL is not set. API requests will use relative paths.',
  )
}

// ---------------------------------------------------------------------------
// Shared request interceptor — attach Supabase headers (apikey & Bearer auth)
// ---------------------------------------------------------------------------
const attachAuthHeaders = (config) => {
  if (IS_SUPABASE && SUPABASE_KEY) {
    config.headers['apikey'] = SUPABASE_KEY
    if (!config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${SUPABASE_KEY}`
    }
  }
  return config
}

// ---------------------------------------------------------------------------
// Axios instance — unwraps response.data and normalises errors.
// Used by every service for normal reads/writes.
// ---------------------------------------------------------------------------
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
})

apiClient.interceptors.request.use(attachAuthHeaders, (error) => Promise.reject(error))

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message = 'An unexpected error occurred'
    let status = null

    if (error.response) {
      status = error.response.status
      message =
        error.response.data?.message ||
        error.response.data?.msg ||
        error.response.data?.error ||
        error.response.data?.error_description ||
        `Server error (${status})`
    } else if (error.request) {
      message =
        'Unable to reach the server. Check your connection and try again.'
    } else {
      message = error.message || message
    }

    return Promise.reject({
      message,
      status,
      code: error.response?.data?.code,
      raw: error.response?.data,
    })
  },
)

// ---------------------------------------------------------------------------
// Raw axios instance — keeps the FULL response (headers, status), unlike
// apiClient above. Needed to read PostgREST's `Content-Range` header for
// real server-side pagination totals (`Prefer: count=exact`).
// ---------------------------------------------------------------------------
const apiRaw = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

apiRaw.interceptors.request.use(attachAuthHeaders, (error) => Promise.reject(error))

export { apiClient, apiRaw, BASE_URL, SUPABASE_KEY, IS_SUPABASE }

// Signed-in parent + child profiles, as a tiny store React subscribes to.
import { useSyncExternalStore } from 'react'
import { api } from './api.js'
import { track, setAudience } from './analytics.js'
import { t } from './i18n.js'
import { setScope, cacheProfile, flushOutbox, guestData, hasGuestData } from './storage.js'

const KEY_ACTIVE = 'xhw.activeProfile'
let state = { status: 'loading', child: false, user: null, profiles: [], activeId: null, version: 0, notice: null }
const listeners = new Set()

function set(patch) {
  state = { ...state, ...patch, version: state.version + 1 }
  for (const l of listeners) l()
}

export const useAccount = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )

const remember = (id) => {
  try {
    if (id) localStorage.setItem(KEY_ACTIVE, id)
    else localStorage.removeItem(KEY_ACTIVE)
  } catch {
    /* ignore */
  }
}
const remembered = () => {
  try {
    return localStorage.getItem(KEY_ACTIVE)
  } catch {
    return null
  }
}

export async function initAccount() {
  try {
    const { user, profiles, child } = await api('/api/me')
    const id = child ? profiles[0]?.id : profiles.find((p) => p.id === remembered())?.id || profiles[0]?.id || null
    setScope(id)
    set({ status: 'signed-in', child: !!child, user, profiles, activeId: id })
    setAudience({ type: child ? 'child' : 'parent', grade: profiles.find((p) => p.id === id)?.grade })
    flushOutbox()
    if (id) await refreshProgress(id)
  } catch (e) {
    setScope(null)
    // offline with a remembered profile: keep practising against the local cache
    if (e.code === 'offline' && remembered()) {
      setScope(remembered())
      set({ status: 'offline', activeId: remembered() })
    } else {
      set({ status: 'guest', child: false, user: null, profiles: [], activeId: null })
      setAudience({ type: 'guest' })
    }
  }
}

async function refreshProgress(id) {
  try {
    const data = await api(`/api/profiles/${id}/progress`)
    cacheProfile(id, data)
    set({})
  } catch {
    /* keep the cached copy */
  }
}

export async function selectProfile(id) {
  remember(id)
  setScope(id)
  set({ activeId: id })
  setAudience({ type: state.child ? 'child' : 'parent', grade: state.profiles.find((p) => p.id === id)?.grade })
  if (id) await refreshProgress(id)
}

export async function createProfile({ name, grade, avatar }) {
  const first = state.profiles.length === 0
  const { profile } = await api('/api/profiles', { method: 'POST', body: { name, grade, avatar } })
  track('child_profile_create', { grade, first_child: first })
  set({ profiles: [...state.profiles, profile] })
  // the first child inherits whatever was practised on this device before signing in
  if (first && hasGuestData()) {
    try {
      await api(`/api/profiles/${profile.id}/import`, { method: 'POST', body: guestData() })
      set({ notice: t('已把这台设备上的练习记录合并到「{name}」', { name: profile.name }) })
    } catch {
      /* not fatal */
    }
  }
  await selectProfile(profile.id)
  return profile
}

export async function updateProfile(id, patch) {
  const { profile } = await api(`/api/profiles/${id}`, { method: 'PATCH', body: patch })
  set({ profiles: state.profiles.map((p) => (p.id === id ? profile : p)) })
}

export async function deleteProfile(id) {
  await api(`/api/profiles/${id}`, { method: 'DELETE' })
  const profiles = state.profiles.filter((p) => p.id !== id)
  set({ profiles })
  if (state.activeId === id) await selectProfile(profiles[0]?.id || null)
}

export async function signOut() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
  remember(null)
  setScope(null)
  set({ status: 'guest', child: false, user: null, profiles: [], activeId: null })
}

export async function deleteAccount() {
  await api('/api/account', { method: 'DELETE' })
  remember(null)
  setScope(null)
  set({ status: 'guest', user: null, profiles: [], activeId: null, notice: '账号和所有练习记录已删除' })
}

export const clearNotice = () => set({ notice: null })
export const showNotice = (notice) => set({ notice })

// ---- children ----------------------------------------------------------------

const KEY_FAMILY = 'xhw.familyEmail'
export const familyEmail = () => {
  try {
    return localStorage.getItem(KEY_FAMILY) || ''
  } catch {
    return ''
  }
}

/** A child signs in with the parent's email + their PIN; this device stays signed in for 6 months. */
export async function childSignIn(email, pin) {
  await api('/api/auth/child', { method: 'POST', body: { email, pin } })
  track('login', { method: 'pin' })
  try {
    localStorage.setItem(KEY_FAMILY, email.trim().toLowerCase())
  } catch {
    /* ignore */
  }
  await initAccount()
}

/** Parent gives this device to a child: the parent is signed out here, the child signed in. */
export async function handOver(id) {
  await api(`/api/profiles/${id}/handover`, { method: 'POST' })
  try {
    localStorage.setItem(KEY_FAMILY, state.user?.email || '')
  } catch {
    /* ignore */
  }
  await initAccount()
}

export async function setPin(id, pin) {
  await api(`/api/profiles/${id}/pin`, { method: 'PUT', body: { pin } })
  set({ profiles: state.profiles.map((p) => (p.id === id ? { ...p, hasPin: true } : p)) })
}

export const listDevices = (id) => api(`/api/profiles/${id}/devices`).then((r) => r.devices)

export async function revokeDevices(id) {
  await api(`/api/profiles/${id}/devices`, { method: 'DELETE' })
  set({ profiles: state.profiles.map((p) => (p.id === id ? { ...p, devices: 0 } : p)) })
}

export const sendEmailLink = (email) => api('/api/auth/email/start', { method: 'POST', body: { email } })
export const verifyEmailCode = (email, code) =>
  api('/api/auth/email/code', { method: 'POST', body: { email, code } }).then((r) => {
    track('login', { method: 'email_code' })
    return r
  })

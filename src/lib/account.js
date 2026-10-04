// Signed-in parent + child profiles, as a tiny store React subscribes to.
import { useSyncExternalStore } from 'react'
import { api } from './api.js'
import { setScope, cacheProfile, flushOutbox, guestData, hasGuestData } from './storage.js'

const KEY_ACTIVE = 'xhw.activeProfile'
let state = { status: 'loading', user: null, profiles: [], activeId: null, version: 0, notice: null }
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
    const { user, profiles } = await api('/api/me')
    const id = profiles.find((p) => p.id === remembered())?.id || profiles[0]?.id || null
    setScope(id)
    set({ status: 'signed-in', user, profiles, activeId: id })
    flushOutbox()
    if (id) await refreshProgress(id)
  } catch (e) {
    setScope(null)
    // offline with a remembered profile: keep practising against the local cache
    if (e.code === 'offline' && remembered()) {
      setScope(remembered())
      set({ status: 'offline', activeId: remembered() })
    } else set({ status: 'guest', user: null, profiles: [], activeId: null })
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
  if (id) await refreshProgress(id)
}

export async function createProfile({ name, grade, avatar }) {
  const first = state.profiles.length === 0
  const { profile } = await api('/api/profiles', { method: 'POST', body: { name, grade, avatar } })
  set({ profiles: [...state.profiles, profile] })
  // the first child inherits whatever was practised on this device before signing in
  if (first && hasGuestData()) {
    try {
      await api(`/api/profiles/${profile.id}/import`, { method: 'POST', body: guestData() })
      set({ notice: `已把这台设备上的练习记录合并到「${profile.name}」` })
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
  set({ status: 'guest', user: null, profiles: [], activeId: null })
}

export async function deleteAccount() {
  await api('/api/account', { method: 'DELETE' })
  remember(null)
  setScope(null)
  set({ status: 'guest', user: null, profiles: [], activeId: null, notice: '账号和所有练习记录已删除' })
}

export const clearNotice = () => set({ notice: null })
export const showNotice = (notice) => set({ notice })

export const sendEmailLink = (email) => api('/api/auth/email/start', { method: 'POST', body: { email } })
export const verifyEmailCode = (email, code) => api('/api/auth/email/code', { method: 'POST', body: { email, code } })

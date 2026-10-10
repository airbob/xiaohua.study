#!/usr/bin/env node
// Pre-generates every clip the app plays — each word and each example sentence — with
// Azure neural TTS, so the site only serves static mp3s and never calls Azure itself.
//
// Credentials: copy scripts/tts.local.example.json to scripts/tts.local.json (gitignored)
// and fill in ONE of:
//   proxy  — the xiaohua TTS worker: { "proxyUrl": "https://…/v1/tts", "proxyToken": "…" }
//   direct — Azure itself:           { "azureKey": "…", "azureRegion": "southeastasia" }
// Env vars TTS_PROXY_URL / TTS_PROXY_TOKEN / AZURE_SPEECH_KEY / AZURE_SPEECH_REGION override the file.
//
//   node scripts/gen-tts.mjs              # generate everything missing
//   LIMIT=5 node scripts/gen-tts.mjs      # try a few first and listen
//   DRY=1 node scripts/gen-tts.mjs        # just count
//   FORCE=1 node scripts/gen-tts.mjs      # regenerate existing clips (e.g. after changing voice)
//   ONLY=还是,长大 FORCE=1 node scripts/gen-tts.mjs   # redo just these words (and their sentences)
// Other env: VOICE (default zh-CN-XiaoxiaoNeural), CONCURRENCY (default 3)
//
// Output: public/audio/w/<word>.mp3, public/audio/s/<word>.mp3, public/audio/p/<id>.mp3 (praise
// lines from src/lib/praise.js, read in a cheerful voice), and src/data/audio-index.json
// listing the clips the app should use. Re-runnable; failures are retried on the next run.
//
// Pronunciation fixes: if a word comes out wrong (多音字), add it to data/tts-overrides.json
// ({ "word": "pinyin with tone marks, space separated" }) — it is then spoken syllable by
// syllable with forced pronunciation. An empty string uses the pinyin from words.json.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { PRAISE } from '../src/lib/praise.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async (p, fallback) => {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'))
  } catch {
    return fallback
  }
}

const local = await readJson(path.join(ROOT, 'scripts/tts.local.json'), {})
const cfg = {
  proxyUrl: process.env.TTS_PROXY_URL || local.proxyUrl,
  proxyToken: process.env.TTS_PROXY_TOKEN || local.proxyToken,
  azureKey: process.env.AZURE_SPEECH_KEY || local.azureKey,
  azureRegion: process.env.AZURE_SPEECH_REGION || local.azureRegion || 'southeastasia',
}
const mode = cfg.proxyUrl && cfg.proxyToken ? 'proxy' : cfg.azureKey ? 'direct' : null

const VOICE = process.env.VOICE || local.voice || 'zh-CN-XiaoxiaoNeural'
const WORD_RATE = '-20%' // words are dictated: slow and clear
const SENTENCE_RATE = '-10%'
const CONCURRENCY = Number(process.env.CONCURRENCY || 3)
const DRY = !!process.env.DRY
const FORCE = !!process.env.FORCE
const LIMIT = Number(process.env.LIMIT || Infinity)
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(/[,，\s]+/).filter(Boolean)) : null
const EXTRA_WORDS = ['对了'] // old feedback clip, still played by pages loaded before the praise lines
const PRAISE_RATE = '+0%'

const words = await readJson(path.join(ROOT, 'src/data/words.json'), [])
const overrides = await readJson(path.join(ROOT, 'data/tts-overrides.json'), {})
const pinyinOf = new Map(words.map((w) => [w.word, w.pinyin]))

// ---- SSML ------------------------------------------------------------------
const esc = (s) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])

const TONES = { ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4], ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4], ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4], ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4], ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4], ǖ: ['v', 1], ǘ: ['v', 2], ǚ: ['v', 3], ǜ: ['v', 4], ü: ['v', 5] }
// "hào" -> "hao 4" (Azure SAPI phone set for zh-CN, same as the xiaohua app)
function sapi(py) {
  let base = '', tone = 5
  for (const ch of py.normalize('NFC').toLowerCase()) {
    if (TONES[ch]) {
      base += TONES[ch][0]
      if (TONES[ch][1] < 5) tone = TONES[ch][1]
    } else base += ch
  }
  return `${base} ${tone}`
}

function body(job) {
  if (job.kind === 'w' && job.word in overrides) {
    const py = overrides[job.word] ? overrides[job.word].split(/\s+/) : pinyinOf.get(job.word) || []
    const chars = [...job.word]
    if (py.length === chars.length)
      return chars.map((c, i) => `<phoneme alphabet="sapi" ph="${sapi(py[i])}">${esc(c)}</phoneme>`).join('')
    console.warn(`  ! override for ${job.word} has ${py.length} syllables for ${chars.length} characters — ignored`)
  }
  return esc(job.text)
}

// xml:lang="zh-CN" and the leading <speak are required by the xiaohua worker's filter
const ssml = (job) =>
  job.kind === 'p'
    ? `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="${VOICE}"><mstts:express-as style="cheerful" styledegree="1.6"><prosody rate="${job.rate}" pitch="+5%">${esc(job.text)}</prosody></mstts:express-as></voice></speak>`
    : `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="${VOICE}"><prosody rate="${job.rate}">${body(job)}</prosody></voice></speak>`

// ---- jobs ------------------------------------------------------------------
const jobs = []
for (const w of [...words.map((w) => w.word), ...EXTRA_WORDS]) jobs.push({ kind: 'w', word: w, text: w, rate: WORD_RATE })
for (const w of words)
  if (w.example) jobs.push({ kind: 's', word: w.word, text: w.example.replace(/（[　 ]+）/, w.word), rate: SENTENCE_RATE })
for (const p of PRAISE) jobs.push({ kind: 'p', word: p.id, text: p.text, rate: PRAISE_RATE })

const file = (j) => path.join(ROOT, 'public/audio', j.kind, `${j.word}.mp3`)
const exists = (f) => fs.stat(f).then((s) => s.size > 0, () => false)

// ---- network ---------------------------------------------------------------
async function synth(job, attempt = 1) {
  const req =
    mode === 'proxy'
      ? { url: cfg.proxyUrl, headers: { 'X-App-Token': cfg.proxyToken } }
      : {
          url: `https://${cfg.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
          headers: { 'Ocp-Apim-Subscription-Key': cfg.azureKey, 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' },
        }
  let res
  try {
    res = await fetch(req.url, {
      method: 'POST',
      headers: { ...req.headers, 'Content-Type': 'application/ssml+xml', 'User-Agent': 'xiehuawen-tts' },
      body: ssml(job),
      signal: AbortSignal.timeout(30000),
    })
  } catch (e) {
    if (attempt < 4) return retry(job, attempt, 2000 * attempt)
    throw e
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 6) {
    const wait = Number(res.headers.get('retry-after') || 0) * 1000 || 3000 * attempt
    return retry(job, attempt, wait)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 500) throw new Error(`suspiciously small response (${buf.length} bytes)`)
  return buf
}
const retry = (job, attempt, ms) => new Promise((r) => setTimeout(r, ms)).then(() => synth(job, attempt + 1))

// The xiaohua worker always returns 96 kbps; speech needs half that. Re-encode with
// ffmpeg when it's installed (halves the ~76 MB total), otherwise keep the original.
const BITRATE = '48k'
const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0
function shrink(buf) {
  if (!HAS_FFMPEG) return Promise.resolve(buf)
  return new Promise((resolve) => {
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', '24000', '-b:a', BITRATE, '-f', 'mp3', 'pipe:1'])
    const out = []
    ff.stdout.on('data', (d) => out.push(d))
    ff.on('close', (code) => resolve(code === 0 && out.length ? Buffer.concat(out) : buf))
    ff.stdin.on('error', () => {})
    ff.stdin.end(buf)
  })
}

// ---- run -------------------------------------------------------------------
const todo = []
for (const j of jobs) if ((!ONLY || ONLY.has(j.word)) && (FORCE || !(await exists(file(j))))) todo.push(j)
const batch = todo.slice(0, LIMIT)
const chars = batch.reduce((n, j) => n + j.text.length, 0)
console.log(`${jobs.length} clips in total (${jobs.filter((j) => j.kind === 'w').length} words, ${jobs.filter((j) => j.kind === 's').length} sentences, ${jobs.filter((j) => j.kind === 'p').length} praise)`)
console.log(`${todo.length} to generate${batch.length < todo.length ? `, doing ${batch.length} now` : ''} · ~${chars} characters · voice ${VOICE} · mode ${mode || 'none'}`)

if (!DRY && batch.length) {
  if (!mode) {
    console.error('\nNo credentials. Copy scripts/tts.local.example.json to scripts/tts.local.json and fill it in.')
    process.exit(1)
  }
  await fs.mkdir(path.join(ROOT, 'public/audio/w'), { recursive: true })
  await fs.mkdir(path.join(ROOT, 'public/audio/s'), { recursive: true })
  await fs.mkdir(path.join(ROOT, 'public/audio/p'), { recursive: true })
  let done = 0, failed = 0
  const queue = [...batch]
  const t0 = Date.now()
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const j = queue.shift()
        try {
          await fs.writeFile(file(j), await shrink(await synth(j)))
          done++
          if (done % 50 === 0 || batch.length <= 20) console.log(`  ✓ ${done}/${batch.length}  ${j.kind}/${j.word}`)
        } catch (e) {
          failed++
          console.error(`  ✗ ${j.kind}/${j.word}: ${e.message}`)
          if (/HTTP 40[13]/.test(e.message) && queue.length) {
            console.error('Credentials rejected — stopping.')
            queue.length = 0
          }
        }
      }
    }),
  )
  console.log(`generated ${done}, failed ${failed} in ${Math.round((Date.now() - t0) / 1000)}s`)
}

// the index reflects what is on disk, so a partial run is still usable
const index = { voice: VOICE, words: [], sentences: [], praise: [] }
for (const j of jobs) if (await exists(file(j))) index[{ w: 'words', s: 'sentences', p: 'praise' }[j.kind]].push(j.word)
if (!DRY) await fs.writeFile(path.join(ROOT, 'src/data/audio-index.json'), JSON.stringify(index))
console.log(`audio index: ${index.words.length} words, ${index.sentences.length} sentences, ${index.praise.length} praise${DRY ? ' (dry run, not written)' : ''}`)

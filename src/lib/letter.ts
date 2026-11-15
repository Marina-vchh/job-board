// Сопроводительное письмо без нейросети: собирается из вашего «Обо мне» и текста вакансии.
// Принципы: коротко (5–7 предложений), конкретные факты вместо прилагательных,
// без штампов («thrilled», «passionate», «leverage», «I am writing to express…», длинные тире).

import { cleanCompany, stripHtml } from './format'

export interface About {
  name: string
  intro: string // 1–2 предложения: кто вы и чем занимаетесь
  skills: string // по строке на навык: «ключевые слова: факт/результат»
  location: string
}

export const EMPTY_ABOUT: About = { name: 'Marina', intro: '', skills: '', location: 'Prague' }

export interface Skill {
  keys: string[]
  label: string
  proof: string
}

/** «affiliate, партнёрки: Вырастила сеть до 120 партнёров» → keys + proof */
export function parseSkills(text: string): Skill[] {
  return text
    .split('\n')
    .map((l) => l.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([^:—–]+?)\s*(?::|—|–| - )\s*(.+)$/)
      const head = m ? m[1] : line
      const proof = m ? m[2].trim() : ''
      const keys = head
        .split(/[,/]/)
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 1)
      return { keys, label: head.split(/[,/]/)[0].trim(), proof }
    })
    .filter((s) => s.keys.length)
}

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

const pick = <T,>(arr: T[], seed: number) => arr[seed % arr.length]

function sentence(s: string) {
  const t = s.trim().replace(/\s*[—–]\s*/g, ', ')
  if (!t) return ''
  const cap = t[0].toUpperCase() + t.slice(1)
  return /[.!?]$/.test(cap) ? cap : cap + '.'
}

function isCyrillic(text: string) {
  const letters = text.replace(/[^a-zA-Zа-яА-ЯёЁіїєґІЇЄҐ]/g, '')
  if (!letters) return false
  return (letters.match(/[а-яА-ЯёЁіїєґІЇЄҐ]/g)?.length ?? 0) / letters.length > 0.4
}

export interface LetterInput {
  id: string
  title: string | null
  company: string | null
  description: string | null
  summary: string | null
  location: string | null
  work_mode: string | null
}

export function generateLetter(v: LetterInput, about: About): string {
  const text = stripHtml(`${v.title ?? ''}\n${v.summary ?? ''}\n${v.description ?? ''}`).toLowerCase()
  const ru = isCyrillic(`${v.title} ${v.description ?? ''}`)
  const seed = hash(v.id)
  const company = cleanCompany(v.company)
  const title = (v.title ?? '').trim() || (ru ? 'эту позицию' : 'this role')
  const skills = parseSkills(about.skills)

  // навыки, которые прямо упоминаются в вакансии, — по числу совпадений
  const scored = skills
    .map((s) => ({ s, hits: s.keys.filter((k) => text.includes(k)).length }))
    .sort((a, b) => b.hits - a.hits)
  let matched = scored.filter((x) => x.hits > 0).map((x) => x.s)
  if (!matched.length) matched = skills.slice(0, 2)
  const top = matched.slice(0, 3)
  const topics = top.slice(0, 2).map((s) => (/^[A-ZА-Я0-9]{2,}/.test(s.label) ? s.label : s.label.toLowerCase()))
  const proofs = top.map((s) => s.proof).filter(Boolean).slice(0, 3)

  const remote = /remote|удал/i.test(`${v.work_mode} ${v.location}`)
  const inPrague = /prague|praha|прага|czech|česk/i.test(v.location ?? '')
  const loc = about.location || 'Prague'
  const name = about.name || ''

  if (ru) {
    const greet = 'Здравствуйте!'
    const open = company ? `Откликаюсь на вакансию ${title} в ${company}.` : `Откликаюсь на вакансию ${title}.`
    const intro = about.intro ? sentence(about.intro) : '[Одно-два предложения о себе: кто вы и чем занимаетесь.]'
    const fit = topics.length
      ? pick([`В описании на первом месте: ${topics.join(' и ')}. Это основная часть моей работы.`, `Главное в этой роли, судя по описанию: ${topics.join(' и ')}. Этим я и занимаюсь.`], seed)
      : ''
    const proofLines = proofs.length ? proofs.map(sentence).join(' ') : '[Один-два конкретных результата с цифрами.]'
    const where = remote ? `Работаю удалённо из ${loc === 'Prague' ? 'Праги' : loc}, часовой пояс CET.` : inPrague ? 'Живу в Праге, могу выходить в офис.' : `Живу в ${loc === 'Prague' ? 'Праге' : loc}.`
    const close = pick(['Буду рада созвониться и рассказать подробнее.', 'Если откликается, давайте созвонимся.', 'Удобно будет обсудить на коротком звонке.'], seed)
    return [greet, `${open} ${intro}`, [fit, proofLines].filter(Boolean).join(' '), `${where} ${close}`, name].filter(Boolean).join('\n\n')
  }

  const greet = company ? pick([`Hi ${company} team,`, `Hello ${company} team,`], seed) : 'Hello,'
  const open = pick([`I'd like to apply for the ${title} role.`, `I'm applying for the ${title} position.`], seed)
  const intro = about.intro ? sentence(about.intro) : '[One or two sentences about you: what you do and for how long.]'
  const fit =
    topics.length === 2
      ? pick([`The role is largely about ${topics[0]} and ${topics[1]}, which is most of what I do day to day.`, `From the description, ${topics[0]} and ${topics[1]} carry most of the weight here. That's my core work.`], seed)
      : topics.length === 1
        ? `The description puts ${topics[0]} first, and that's my core work.`
        : ''
  const proofLines = proofs.length ? proofs.map(sentence).join(' ') : '[One or two concrete results with numbers.]'
  const where = remote ? `I work remotely from ${loc} (CET).` : inPrague ? `I'm based in Prague and can work from the office.` : `I'm based in ${loc}.`
  const close = pick([`Happy to talk if this looks like a fit.`, `Glad to go into details on a short call.`, `Let me know if a quick call makes sense.`], seed)
  return [greet, `${open} ${intro}`, [fit, proofLines].filter(Boolean).join(' '), `${where} ${close}`, name ? `Best,\n${name}` : 'Best,'].join('\n\n')
}

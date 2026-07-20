import type { CVPayload, Certification, DateFormat, Education, Experience } from './types'

export const PRESENT_VALUES = new Set(['present', 'current', 'now'])

export const CV_STYLES = [
  { id: 'classic', name: 'Classic', description: 'Editorial and timeless', swatch: 'navy' },
  { id: 'minimal', name: 'Minimal', description: 'Quiet and compact', swatch: 'charcoal' },
  { id: 'modern', name: 'Modern', description: 'Bold and confident', swatch: 'blue' },
] as const

export const safePdfName = (value: string) => {
  const withoutExtension = value.trim().replace(/\.pdf$/i, '')
  return withoutExtension.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim() || 'cv'
}

export const emptyExperience = (): Experience => ({
  company: '', role: '', startDate: '', endDate: '', currentlyWorking: false, bullets: '',
})

export const emptyCertification = (): Certification => ({
  name: '', issuer: '', year: '', credentialId: '',
})

export const emptyEducation = (): Education => ({
  institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', details: '',
})

const dateRank = (value: string): number => {
  const cleaned = value.trim().toLowerCase()
  if (!cleaned) return 0
  if (PRESENT_VALUES.has(cleaned)) return 999912
  const match = cleaned.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!match) return 0
  return Number(match[1]) * 100 + Math.max(1, Math.min(12, Number(match[2])))
}

export const sortExperiencesNewestFirst = (items: CVPayload['experiences']) =>
  [...items].sort((a, b) => dateRank(b.end_date) - dateRank(a.end_date) || dateRank(b.start_date) - dateRank(a.start_date))

export const formatDateValue = (value: string, format: DateFormat): string => {
  const cleaned = value.trim()
  if (!cleaned) return '-'
  if (PRESENT_VALUES.has(cleaned.toLowerCase())) return 'Present'
  const match = cleaned.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!match) return cleaned
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3] ?? 1)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (format === 'YYYY-MM') return `${year}-${String(month).padStart(2, '0')}`
  if (format === 'MM/YYYY') return `${String(month).padStart(2, '0')}/${year}`
  if (format === 'DD MMM YYYY') {
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

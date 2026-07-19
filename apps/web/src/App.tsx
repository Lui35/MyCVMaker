import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Experience = {
  company: string
  role: string
  startDate: string
  endDate: string
  currentlyWorking: boolean
  bullets: string
}

type Certification = {
  name: string
  issuer: string
  year: string
  credentialId: string
}

type DateFormat = 'MMM YYYY' | 'MM/YYYY' | 'YYYY-MM' | 'DD MMM YYYY'

type CVPayload = {
  version_name: string
  full_name: string
  title: string
  summary: string
  style: string
  date_format: DateFormat
  programmer_profile: {
    programming_languages: string
    frameworks: string
    databases: string
    tools: string
    github_url: string
    portfolio_url: string
  }
  certifications: Array<{
    name: string
    issuer: string
    year: string
    credential_id: string
  }>
  experiences: Array<{
    company: string
    role: string
    start_date: string
    end_date: string
    bullets: string
  }>
}

type CVVersionSummary = {
  id: string
  version_name: string
  is_default: boolean
}

type ApiCVRecord = CVPayload & {
  id: string
  is_default: boolean
}

type EditableCVRecord = CVPayload & {
  id?: string
  is_default?: boolean
}

type TailorResult = {
  tailored_cv: CVPayload
  match_score: number
  matched_keywords: string[]
  missing_keywords: string[]
  changes: string[]
  warnings: string[]
  experience_gap_suggestions: Array<{
    target_experience_index: number
    requirement: string
    suggested_bullet: string
    confirmation_note: string
  }>
}

type ImportResult = {
  cv: CVPayload
  warnings: string[]
  source_name: string
}

type SectionSuggestion = {
  key: string
  enhanced_text: string
  changes: string[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const PRESENT_VALUES = new Set(['present', 'current', 'now'])
const CV_STYLES = [
  { id: 'classic', name: 'Classic', description: 'Editorial and timeless', swatch: 'navy' },
  { id: 'minimal', name: 'Minimal', description: 'Quiet and compact', swatch: 'charcoal' },
  { id: 'modern', name: 'Modern', description: 'Bold and confident', swatch: 'blue' },
] as const

const emptyExperience = (): Experience => ({
  company: '',
  role: '',
  startDate: '',
  endDate: '',
  currentlyWorking: false,
  bullets: '',
})

const emptyCertification = (): Certification => ({
  name: '',
  issuer: '',
  year: '',
  credentialId: '',
})

const getDateRank = (value: string): number => {
  const cleaned = value.trim().toLowerCase()
  if (!cleaned) return 0
  if (PRESENT_VALUES.has(cleaned)) return 999912
  const match = cleaned.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!match) return 0
  const year = Number(match[1])
  const month = Math.max(1, Math.min(12, Number(match[2])))
  return year * 100 + month
}

const sortExperiencesNewestFirst = (items: CVPayload['experiences']) =>
  [...items].sort((a, b) => {
    const endDiff = getDateRank(b.end_date) - getDateRank(a.end_date)
    if (endDiff !== 0) return endDiff
    return getDateRank(b.start_date) - getDateRank(a.start_date)
  })

const formatDateValue = (value: string, format: DateFormat): string => {
  const cleaned = value.trim()
  if (!cleaned) return '-'
  if (PRESENT_VALUES.has(cleaned.toLowerCase())) return 'Present'
  const match = cleaned.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!match) return cleaned
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3] ?? 1)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (format === 'YYYY-MM') return `${String(year)}-${String(month).padStart(2, '0')}`
  if (format === 'MM/YYYY') return `${String(month).padStart(2, '0')}/${String(year)}`
  if (format === 'DD MMM YYYY') {
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('cv-maker-theme') === 'dark')
  const [activeView, setActiveView] = useState<'editor' | 'manage'>('editor')
  const [statusMessage, setStatusMessage] = useState('')
  const [versions, setVersions] = useState<CVVersionSummary[]>([])
  const [currentCvId, setCurrentCvId] = useState<string | null>(null)

  const [versionName, setVersionName] = useState('My CV')
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [style, setStyle] = useState('classic')
  const [dateFormat, setDateFormat] = useState<DateFormat>('MMM YYYY')
  const [programmingLanguages, setProgrammingLanguages] = useState('')
  const [frameworks, setFrameworks] = useState('')
  const [databases, setDatabases] = useState('')
  const [tools, setTools] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [experiences, setExperiences] = useState<Experience[]>([emptyExperience()])
  const [certifications, setCertifications] = useState<Certification[]>([emptyCertification()])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [aiBusy, setAiBusy] = useState<string | null>(null)
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null)
  const [confirmedGapSuggestions, setConfirmedGapSuggestions] = useState<number[]>([])
  const [sectionSuggestion, setSectionSuggestion] = useState<SectionSuggestion | null>(null)

  const toPayload = (): CVPayload => ({
    version_name: versionName,
    full_name: fullName,
    title,
    summary,
    style,
    date_format: dateFormat,
    programmer_profile: {
      programming_languages: programmingLanguages,
      frameworks,
      databases,
      tools,
      github_url: githubUrl,
      portfolio_url: portfolioUrl,
    },
    certifications: certifications
      .filter((cert) => cert.name && cert.issuer && cert.year)
      .map((cert) => ({
        name: cert.name,
        issuer: cert.issuer,
        year: cert.year,
        credential_id: cert.credentialId,
      })),
    experiences: experiences
      .filter((exp) => exp.company.trim() && exp.role.trim() && exp.startDate && (exp.currentlyWorking || exp.endDate))
      .map((exp) => ({
        company: exp.company,
        role: exp.role,
        start_date: exp.startDate,
        end_date: exp.currentlyWorking ? 'Present' : exp.endDate,
        bullets: exp.bullets,
      })),
  })

  const applyCvData = (cv: EditableCVRecord) => {
    setCurrentCvId(cv.id ?? null)
    setVersionName(cv.version_name ?? 'My CV')
    setFullName(cv.full_name ?? '')
    setTitle(cv.title ?? '')
    setSummary(cv.summary ?? '')
    setStyle(cv.style ?? 'classic')
    setDateFormat((cv.date_format ?? 'MMM YYYY') as DateFormat)
    setProgrammingLanguages(cv.programmer_profile?.programming_languages ?? '')
    setFrameworks(cv.programmer_profile?.frameworks ?? '')
    setDatabases(cv.programmer_profile?.databases ?? '')
    setTools(cv.programmer_profile?.tools ?? '')
    setGithubUrl(cv.programmer_profile?.github_url ?? '')
    setPortfolioUrl(cv.programmer_profile?.portfolio_url ?? '')
    const mappedExperiences = (cv.experiences ?? []).map((exp) => {
      const isCurrent = PRESENT_VALUES.has(String(exp.end_date ?? '').toLowerCase())
      return {
        company: exp.company ?? '',
        role: exp.role ?? '',
        startDate: exp.start_date ?? '',
        endDate: isCurrent ? '' : (exp.end_date ?? ''),
        currentlyWorking: isCurrent,
        bullets: exp.bullets ?? '',
      } as Experience
    })
    setExperiences(mappedExperiences.length > 0 ? mappedExperiences : [emptyExperience()])
    const mappedCerts = (cv.certifications ?? []).map((cert) => ({
      name: cert.name ?? '',
      issuer: cert.issuer ?? '',
      year: cert.year ?? '',
      credentialId: cert.credential_id ?? '',
    }))
    setCertifications(mappedCerts.length > 0 ? mappedCerts : [emptyCertification()])
  }

  const loadVersions = async () => {
    const response = await fetch(`${API_BASE_URL}/cvs`)
    if (!response.ok) {
      setStatusMessage('Could not load CV versions.')
      return []
    }
    const data = (await response.json()) as CVVersionSummary[]
    setVersions(data)
    return data
  }

  const loadCv = async (cvId: string) => {
    const response = await fetch(`${API_BASE_URL}/cvs/${cvId}`)
    if (!response.ok) {
      setStatusMessage('Could not load selected CV.')
      return
    }
    const data = (await response.json()) as ApiCVRecord
    applyCvData(data)
  }

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/cvs`)
        if (!response.ok) throw new Error('Versions request failed')
        const list = (await response.json()) as CVVersionSummary[]
        setVersions(list)
        if (!list.length) return
        const preferred = list.find((v) => v.is_default) ?? list[0]
        const cvResponse = await fetch(`${API_BASE_URL}/cvs/${preferred.id}`)
        if (!cvResponse.ok) throw new Error('CV request failed')
        const cvData = (await cvResponse.json()) as ApiCVRecord
        applyCvData(cvData)
      } catch {
        setStatusMessage('The editor is ready, but saved versions are unavailable. Start the API to sync and export.')
      }
    }
    void bootstrap()
  }, [])

  useEffect(() => {
    localStorage.setItem('cv-maker-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  const updateExperience = (index: number, field: keyof Experience, value: string) => {
    const next = [...experiences]
    next[index] = { ...next[index], [field]: value }
    setExperiences(next)
  }

  const toggleCurrentlyWorking = (index: number, checked: boolean) => {
    const next = [...experiences]
    next[index] = { ...next[index], currentlyWorking: checked, endDate: checked ? '' : next[index].endDate }
    setExperiences(next)
  }

  const addExperience = () => setExperiences((current) => [...current, emptyExperience()])
  const removeExperience = (index: number) =>
    setExperiences((current) => (current.length === 1 ? [emptyExperience()] : current.filter((_, i) => i !== index)))

  const updateCertification = (index: number, field: keyof Certification, value: string) => {
    const next = [...certifications]
    next[index] = { ...next[index], [field]: value }
    setCertifications(next)
  }

  const addCertification = () => setCertifications((current) => [...current, emptyCertification()])
  const removeCertification = (index: number) =>
    setCertifications((current) => (current.length === 1 ? [emptyCertification()] : current.filter((_, i) => i !== index)))

  const clearFormForNew = () => {
    setCurrentCvId(null)
    setVersionName('New CV')
    setFullName('')
    setTitle('')
    setSummary('')
    setStyle('classic')
    setDateFormat('MMM YYYY')
    setProgrammingLanguages('')
    setFrameworks('')
    setDatabases('')
    setTools('')
    setGithubUrl('')
    setPortfolioUrl('')
    setExperiences([emptyExperience()])
    setCertifications([emptyCertification()])
    setStatusMessage('Started a new CV version.')
  }

  const saveDraft = async (e: FormEvent) => {
    e.preventDefault()
    const payload = toPayload()
    const isUpdate = Boolean(currentCvId)
    const endpoint = isUpdate ? `${API_BASE_URL}/cvs/${currentCvId}` : `${API_BASE_URL}/cvs`
    const method = isUpdate ? 'PUT' : 'POST'
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      setStatusMessage('Could not save CV version.')
      return
    }
    const data = (await response.json()) as { id: string }
    setCurrentCvId(data.id)
    const list = await loadVersions()
    if (list.length) {
      const selected = list.find((v) => v.id === data.id)
      if (selected) setVersionName(selected.version_name)
    }
    setStatusMessage('CV version saved.')
  }

  const duplicateCurrent = async () => {
    if (!currentCvId) {
      setStatusMessage('Save this CV before duplicating.')
      return
    }
    const response = await fetch(`${API_BASE_URL}/cvs/${currentCvId}/duplicate`, { method: 'POST' })
    if (!response.ok) {
      setStatusMessage('Could not duplicate CV version.')
      return
    }
    const data = (await response.json()) as { id: string }
    await loadVersions()
    await loadCv(data.id)
    setStatusMessage('CV duplicated.')
  }

  const setAsDefault = async () => {
    if (!currentCvId) {
      setStatusMessage('Save this CV before setting as default.')
      return
    }
    const response = await fetch(`${API_BASE_URL}/cvs/${currentCvId}/set-default`, { method: 'POST' })
    if (!response.ok) {
      setStatusMessage('Could not set default CV.')
      return
    }
    await loadVersions()
    setStatusMessage('Default CV updated.')
  }

  const deleteCurrentCv = async () => {
    if (!currentCvId) {
      setStatusMessage('Select a saved CV version before deleting.')
      return
    }
    const selectedVersion = versions.find((version) => version.id === currentCvId)
    const displayName = selectedVersion?.version_name || versionName || 'this CV'
    if (!window.confirm(`Delete "${displayName}" permanently? This cannot be undone.`)) return

    const response = await fetch(`${API_BASE_URL}/cvs/${currentCvId}`, { method: 'DELETE' })
    if (!response.ok) {
      setStatusMessage(await getApiError(response, 'Could not delete this CV version.'))
      return
    }

    const remaining = await loadVersions()
    if (remaining.length) {
      const nextVersion = remaining.find((version) => version.is_default) ?? remaining[0]
      await loadCv(nextVersion.id)
    } else {
      clearFormForNew()
    }
    setStatusMessage(`Deleted "${displayName}".`)
  }

  const openManagedCv = async (cvId: string) => {
    await loadCv(cvId)
    setActiveView('editor')
    setStatusMessage('CV opened in the editor.')
  }

  const duplicateManagedCv = async (cvId: string, displayName: string) => {
    const response = await fetch(`${API_BASE_URL}/cvs/${cvId}/duplicate`, { method: 'POST' })
    if (!response.ok) {
      setStatusMessage(await getApiError(response, 'Could not duplicate this CV version.'))
      return
    }
    await loadVersions()
    setStatusMessage(`Duplicated "${displayName}".`)
  }

  const downloadManagedCv = async (cvId: string, displayName: string) => {
    const response = await fetch(`${API_BASE_URL}/cvs/${cvId}`)
    if (!response.ok) {
      setStatusMessage(await getApiError(response, 'Could not load this CV for download.'))
      return
    }
    const cv = (await response.json()) as ApiCVRecord
    await downloadPdfFromPayload(cv)
    setStatusMessage(`Downloaded "${displayName}" as a PDF.`)
  }

  const setManagedCvAsDefault = async (cvId: string, displayName: string) => {
    const response = await fetch(`${API_BASE_URL}/cvs/${cvId}/set-default`, { method: 'POST' })
    if (!response.ok) {
      setStatusMessage(await getApiError(response, 'Could not set this CV as default.'))
      return
    }
    await loadVersions()
    setStatusMessage(`Set "${displayName}" as the default CV.`)
  }

  const deleteManagedCv = async (cvId: string, displayName: string) => {
    if (!window.confirm(`Delete "${displayName}" permanently? This cannot be undone.`)) return
    const response = await fetch(`${API_BASE_URL}/cvs/${cvId}`, { method: 'DELETE' })
    if (!response.ok) {
      setStatusMessage(await getApiError(response, 'Could not delete this CV version.'))
      return
    }
    const remaining = await loadVersions()
    if (cvId === currentCvId) {
      if (remaining.length) {
        const nextVersion = remaining.find((version) => version.is_default) ?? remaining[0]
        await loadCv(nextVersion.id)
      } else {
        clearFormForNew()
      }
    }
    setStatusMessage(`Deleted "${displayName}".`)
  }

  const downloadPdfFromPayload = async (payload: CVPayload) => {
    const response = await fetch(`${API_BASE_URL}/generate/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      setStatusMessage('Could not generate PDF.')
      return
    }
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${payload.version_name || 'cv'}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
    setStatusMessage('PDF generated.')
  }

  const generatePdf = async () => {
    await downloadPdfFromPayload(toPayload())
  }

  const getApiError = async (response: Response, fallback: string) => {
    try {
      const body = (await response.json()) as { detail?: string }
      return body.detail || fallback
    } catch {
      return fallback
    }
  }

  const importCvWithAi = async () => {
    if (!importFile) {
      setStatusMessage('Choose a PDF, DOCX, or TXT CV first.')
      return
    }
    setAiBusy('import')
    setTailorResult(null)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const response = await fetch(`${API_BASE_URL}/ai/import-cv`, { method: 'POST', body: formData })
      if (!response.ok) throw new Error(await getApiError(response, 'Could not import this CV.'))
      const result = (await response.json()) as ImportResult
      applyCvData(result.cv)
      setStatusMessage(
        result.warnings.length
          ? `CV imported. Review these items: ${result.warnings.join(' ')}`
          : 'CV imported into a new unsaved version. Review it before saving.',
      )
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not import this CV.')
    } finally {
      setAiBusy(null)
    }
  }

  const tailorCvWithAi = async () => {
    if (jobDescription.trim().length < 80) {
      setStatusMessage('Paste a fuller job description (at least 80 characters).')
      return
    }
    if (!fullName.trim() || !title.trim() || !summary.trim()) {
      setStatusMessage('Add your name, title, and summary before tailoring this CV.')
      return
    }
    setAiBusy('tailor')
    setConfirmedGapSuggestions([])
    try {
      const response = await fetch(`${API_BASE_URL}/ai/tailor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv: toPayload(), job_description: jobDescription }),
      })
      if (!response.ok) throw new Error(await getApiError(response, 'Could not tailor this CV.'))
      const result = (await response.json()) as TailorResult
      setTailorResult(result)
      setStatusMessage('AI suggestions are ready for review. Your current CV has not been changed.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not tailor this CV.')
    } finally {
      setAiBusy(null)
    }
  }

  const applyTailoredVersion = () => {
    if (!tailorResult) return
    const tailoredCv: CVPayload = {
      ...tailorResult.tailored_cv,
      experiences: tailorResult.tailored_cv.experiences.map((experience) => ({ ...experience })),
    }
    confirmedGapSuggestions.forEach((suggestionIndex) => {
      const suggestion = tailorResult.experience_gap_suggestions[suggestionIndex]
      const target = suggestion ? tailoredCv.experiences[suggestion.target_experience_index] : undefined
      if (!target) return
      target.bullets = [target.bullets.trim(), suggestion.suggested_bullet.trim()].filter(Boolean).join('\n')
    })
    applyCvData(tailoredCv)
    setTailorResult(null)
    setConfirmedGapSuggestions([])
    setStatusMessage(
      confirmedGapSuggestions.length
        ? `Tailored version created with ${confirmedGapSuggestions.length} confirmed experience addition${confirmedGapSuggestions.length === 1 ? '' : 's'}.`
        : 'Tailored suggestions applied as a new unsaved CV version.',
    )
  }

  const toggleGapSuggestion = (index: number, checked: boolean) => {
    setConfirmedGapSuggestions((current) => (
      checked ? [...new Set([...current, index])] : current.filter((item) => item !== index)
    ))
  }

  const enhanceWriting = async (
    key: string,
    sectionType: 'summary' | 'experience',
    content: string,
    context: string,
  ) => {
    if (content.trim().length < 20) {
      setStatusMessage('Add at least 20 characters before enhancing this section.')
      return
    }
    const busyKey = `enhance-${key}`
    setAiBusy(busyKey)
    setSectionSuggestion(null)
    try {
      const response = await fetch(`${API_BASE_URL}/ai/enhance-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_type: sectionType, content, context }),
      })
      if (!response.ok) throw new Error(await getApiError(response, 'Could not enhance this section.'))
      const result = (await response.json()) as Omit<SectionSuggestion, 'key'>
      setSectionSuggestion({ key, ...result })
      setStatusMessage('Enhanced writing is ready for review. Nothing has been replaced yet.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not enhance this section.')
    } finally {
      setAiBusy(null)
    }
  }

  const applySectionSuggestion = (key: string) => {
    if (!sectionSuggestion || sectionSuggestion.key !== key) return
    if (key === 'summary') {
      setSummary(sectionSuggestion.enhanced_text.slice(0, 500))
    } else {
      const index = Number(key.replace('experience-', ''))
      if (Number.isInteger(index) && experiences[index]) {
        updateExperience(index, 'bullets', sectionSuggestion.enhanced_text)
      }
    }
    setSectionSuggestion(null)
    setStatusMessage('Enhanced writing applied. Review the wording before saving or exporting.')
  }

  const renderEnhancementReview = (key: string) => {
    if (!sectionSuggestion || sectionSuggestion.key !== key) return null
    return (
      <aside className="enhance-review" aria-live="polite">
        <div><span className="eyebrow">AI SUGGESTION</span><p>{sectionSuggestion.enhanced_text}</p></div>
        {sectionSuggestion.changes.length ? <ul>{sectionSuggestion.changes.map((change) => <li key={change}>{change}</li>)}</ul> : null}
        <div className="enhance-actions">
          <button type="button" className="ghost" onClick={() => setSectionSuggestion(null)}>Discard</button>
          <button type="button" onClick={() => applySectionSuggestion(key)}>Apply suggestion</button>
        </div>
      </aside>
    )
  }

  const fillDummyData = () => {
    setVersionName('Senior Developer CV')
    setFullName('Alex Johnson')
    setTitle('Senior Full-Stack Developer')
    setSummary('Engineer focused on shipping reliable, scalable products with clean architecture and measurable business impact.')
    setStyle('classic')
    setDateFormat('MMM YYYY')
    setProgrammingLanguages('TypeScript, Python, Go, SQL')
    setFrameworks('React, FastAPI, Node.js, Express')
    setDatabases('PostgreSQL, SQLite, Redis')
    setTools('Docker, GitHub Actions, Terraform, Linux')
    setGithubUrl('https://github.com/alexjohnson')
    setPortfolioUrl('https://alexjohnson.dev')
    setExperiences([
      { company: 'NovaTech', role: 'Senior Software Engineer', startDate: '2023-02-01', endDate: '', currentlyWorking: true, bullets: 'Led migration to microservices and reduced API latency by 42%.' },
      { company: 'CloudLayer', role: 'Software Engineer', startDate: '2020-01-01', endDate: '2023-01-31', currentlyWorking: false, bullets: 'Built internal developer platform and improved reliability to 99.7%.' },
    ])
    setCertifications([
      { name: 'AWS Certified Developer - Associate', issuer: 'Amazon Web Services', year: '2024', credentialId: 'AWS-DEV-001122' },
      { name: 'Professional Scrum Master I', issuer: 'Scrum.org', year: '2022', credentialId: 'PSM-I-778899' },
    ])
    setStatusMessage('Dummy data loaded.')
  }

  const previewPayload = toPayload()
  const previewExperiences = sortExperiencesNewestFirst(previewPayload.experiences)
  const completionChecks = [
    Boolean(fullName.trim()), Boolean(title.trim()), summary.trim().length >= 80,
    Boolean(programmingLanguages.trim() || frameworks.trim() || tools.trim()),
    experiences.some((exp) => exp.company.trim() && exp.role.trim() && exp.startDate),
    experiences.some((exp) => exp.bullets.trim().length >= 40),
    Boolean(githubUrl.trim() || portfolioUrl.trim()),
  ]
  const completion = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100)
  const scoreLabel = completion >= 85 ? 'Strong' : completion >= 55 ? 'Good start' : 'Needs detail'

  return (
    <main className={`layout ${isDarkMode ? 'dark' : ''}`}>
      <header className="page-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">C</span>
          <div>
            <span className="eyebrow">CAREER STUDIO</span>
            <h1>Build a CV that gets read.</h1>
            <p>Shape an ATS-ready story, preview every change, and export with confidence.</p>
          </div>
        </div>
        <div className="topbar">
          <button type="button" className="ghost" aria-pressed={isDarkMode} onClick={() => setIsDarkMode((v) => !v)}>
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          {activeView === 'editor' ? (
            <>
              <button type="button" className="ghost" onClick={fillDummyData}>Fill Dummy Data</button>
              <button type="button" className="primary-action" onClick={generatePdf}>Export PDF <span aria-hidden="true">&#8599;</span></button>
            </>
          ) : null}
        </div>
      </header>

      <nav className="workspace-tabs" role="tablist" aria-label="CV workspace">
        <button type="button" role="tab" aria-selected={activeView === 'editor'} className={activeView === 'editor' ? 'active' : ''} onClick={() => setActiveView('editor')}>Editor</button>
        <button type="button" role="tab" aria-selected={activeView === 'manage'} className={activeView === 'manage' ? 'active' : ''} onClick={() => setActiveView('manage')}>Manage CVs <span>{versions.length}</span></button>
      </nav>

      {activeView === 'manage' ? (
        <section className="cv-manager card" role="tabpanel" aria-labelledby="manage-cvs-title">
          <div className="manager-heading">
            <div><span className="eyebrow">SAVED VERSIONS</span><h2 id="manage-cvs-title">Manage CVs</h2><p>Open, duplicate, prioritize, or remove your saved CV versions.</p></div>
            <button type="button" onClick={() => { clearFormForNew(); setActiveView('editor') }}>Create new CV</button>
          </div>
          {versions.length ? (
            <div className="cv-version-list">
              {versions.map((version) => (
                <article className={`cv-version-card ${version.id === currentCvId ? 'current' : ''}`} key={version.id}>
                  <div className="version-icon" aria-hidden="true">CV</div>
                  <div className="version-details">
                    <div><h3>{version.version_name}</h3>{version.is_default ? <span className="default-badge">Default</span> : null}{version.id === currentCvId ? <span className="current-badge">Open</span> : null}</div>
                    <p>{version.is_default ? 'Loaded automatically when the app starts.' : 'Saved CV version ready to edit or export.'}</p>
                  </div>
                  <div className="version-actions">
                    <button type="button" onClick={() => void openManagedCv(version.id)}>Open</button>
                    <button type="button" className="download-version" onClick={() => void downloadManagedCv(version.id, version.version_name)}>Download PDF</button>
                    <button type="button" className="ghost" onClick={() => void duplicateManagedCv(version.id, version.version_name)}>Duplicate</button>
                    <button type="button" className="ghost" onClick={() => void setManagedCvAsDefault(version.id, version.version_name)} disabled={version.is_default}>Set default</button>
                    <button type="button" className="manager-delete" onClick={() => void deleteManagedCv(version.id, version.version_name)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="manager-empty"><strong>No saved CVs yet</strong><p>Create and save your first CV to manage it here.</p></div>
          )}
        </section>
      ) : (
        <>
      <section className="version-bar card" aria-label="CV version controls">
        <label>
          CV Version
          <select
            value={currentCvId ?? ''}
            onChange={(e) => {
              const selectedId = e.target.value
              if (selectedId) void loadCv(selectedId)
            }}
          >
            <option value="">New unsaved version</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.version_name}{version.is_default ? ' (Default)' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button type="button" onClick={clearFormForNew}>New Version</button>
          <button type="button" onClick={duplicateCurrent}>Duplicate</button>
          <button type="button" onClick={setAsDefault}>Set as Default</button>
          <button type="button" className="delete-version" onClick={deleteCurrentCv} disabled={!currentCvId}>Delete</button>
        </div>
      </section>

      <section className="readiness card" aria-label={`CV readiness ${completion}%`}>
        <div className="readiness-copy">
          <span className="score">{completion}%</span>
          <span><strong>{scoreLabel}</strong><small>CV readiness</small></span>
        </div>
        <div className="progress-track"><span style={{ width: `${completion}%` }} /></div>
        <p>{completion < 85 ? 'Add measurable experience highlights and profile links to strengthen your CV.' : 'Your core sections are in great shape and ready for a final review.'}</p>
      </section>

      <section className="ai-studio card" aria-labelledby="ai-studio-title">
        <div className="ai-studio-heading">
          <div className="ai-title-group"><span className="ai-mark" aria-hidden="true">AI</span><div><span className="eyebrow">GROQ-POWERED WORKSPACE</span><h2 id="ai-studio-title">AI Career Studio</h2></div></div>
          <p>AI suggestions are drafts. Review every fact before saving or exporting.</p>
        </div>
        <div className="ai-grid">
          <article className="ai-tool">
            <span className="tool-number">01</span>
            <div><h3>Import an existing CV</h3><p>Turn a PDF, DOCX, or text CV into editable fields.</p></div>
            <label className="file-picker">
              <span>{importFile ? importFile.name : 'Choose CV file'}</span>
              <small>PDF, DOCX, or TXT · up to 8 MB</small>
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button type="button" onClick={importCvWithAi} disabled={aiBusy !== null}>
              {aiBusy === 'import' ? 'Importing…' : 'Import with AI'}
            </button>
          </article>

          <article className="ai-tool tailor-tool">
            <span className="tool-number">02</span>
            <div><h3>Tailor to a job</h3><p>Improve relevance without inventing experience or skills.</p></div>
            <label>
              Job description
              <textarea
                rows={5}
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value.slice(0, 20000))}
                placeholder="Paste the complete job description here…"
              />
              <small className="field-hint">{jobDescription.length.toLocaleString()} / 20,000 characters</small>
            </label>
            <button type="button" onClick={tailorCvWithAi} disabled={aiBusy !== null}>
              {aiBusy === 'tailor' ? 'Analyzing…' : 'Analyze & tailor'}
            </button>
          </article>
        </div>

        {tailorResult ? (
          <section className="ai-results" aria-label="AI tailoring results">
            <div className="match-score"><strong>{tailorResult.match_score}%</strong><span>Evidence-based match</span></div>
            <div className="result-column"><h3>Matched keywords</h3><div className="keyword-list positive">{tailorResult.matched_keywords.length ? tailorResult.matched_keywords.map((keyword) => <span key={keyword}>{keyword}</span>) : <small>None identified</small>}</div></div>
            <div className="result-column"><h3>Missing evidence</h3><div className="keyword-list warning">{tailorResult.missing_keywords.length ? tailorResult.missing_keywords.map((keyword) => <span key={keyword}>{keyword}</span>) : <small>No major gaps identified</small>}</div></div>
            <div className="result-notes">
              <div><h3>Proposed changes</h3><ul>{tailorResult.changes.map((change) => <li key={change}>{change}</li>)}</ul></div>
              {tailorResult.warnings.length ? <div><h3>Keep in mind</h3><ul>{tailorResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
            </div>
            {tailorResult.experience_gap_suggestions.length ? (
              <div className="gap-suggestions">
                <div className="gap-heading">
                  <div><h3>Experience you may want to add</h3><p>These requirements were not found in your CV. Confirm only the statements you have genuinely done.</p></div>
                  <span>{confirmedGapSuggestions.length} confirmed</span>
                </div>
                <div className="gap-list">
                  {tailorResult.experience_gap_suggestions.map((suggestion, index) => {
                    const target = tailorResult.tailored_cv.experiences[suggestion.target_experience_index]
                    return (
                      <label className={`gap-option ${confirmedGapSuggestions.includes(index) ? 'confirmed' : ''}`} key={`${suggestion.requirement}-${index}`}>
                        <input
                          type="checkbox"
                          checked={confirmedGapSuggestions.includes(index)}
                          onChange={(event) => toggleGapSuggestion(index, event.target.checked)}
                        />
                        <span>
                          <strong>{suggestion.requirement}</strong>
                          <small>Add to {target ? `${target.role} at ${target.company}` : 'the selected experience'}</small>
                          <em>{suggestion.suggested_bullet}</em>
                          <i>Verify: {suggestion.confirmation_note}</i>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : null}
            <div className="result-actions">
              <button type="button" className="ghost" onClick={() => { setTailorResult(null); setConfirmedGapSuggestions([]) }}>Discard</button>
              <button type="button" onClick={applyTailoredVersion}>
                Apply as new version{confirmedGapSuggestions.length ? ` + ${confirmedGapSuggestions.length} confirmed` : ''}
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <section className="workspace">
        <form onSubmit={saveDraft} className="card editor">
          <div className="section-heading"><div><span className="step">01</span><h2>Editor</h2></div><p>Fields update the preview instantly.</p></div>
          <fieldset className="style-fieldset">
            <legend>CV Style</legend>
            <div className="style-picker">
              {CV_STYLES.map((option) => (
                <label className={`style-option ${style === option.id ? 'selected' : ''}`} key={option.id}>
                  <input
                    type="radio"
                    name="cv-style"
                    value={option.id}
                    checked={style === option.id}
                    onChange={(e) => setStyle(e.target.value)}
                  />
                  <span className={`style-swatch ${option.swatch}`} aria-hidden="true"><i /><i /><i /></span>
                  <span><strong>{option.name}</strong><small>{option.description}</small></span>
                  <b aria-hidden="true">{style === option.id ? '✓' : ''}</b>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid">
            <label>
              Version Name
              <input value={versionName} onChange={(e) => setVersionName(e.target.value)} required />
            </label>
            <label>
              Full Name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
          </div>

          <div className="grid single-feature">
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
          </div>

          <div className="writing-field">
            <div className="writing-heading">
              <span>Professional Summary <small>{summary.length}/500</small></span>
              <button
                type="button"
                className="enhance-button"
                disabled={aiBusy !== null}
                onClick={() => void enhanceWriting('summary', 'summary', summary, `Target title: ${title}. Existing skills: ${[programmingLanguages, frameworks, databases, tools].filter(Boolean).join(', ')}`)}
              >
                {aiBusy === 'enhance-summary' ? 'Enhancing…' : '✦ Enhance'}
              </button>
            </div>
            <label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value.slice(0, 500))} rows={4} placeholder="Summarize your impact, specialties, and years of experience…" required />
            <small className="field-hint">Aim for 80–300 characters and lead with outcomes.</small>
            </label>
            {renderEnhancementReview('summary')}
          </div>

          <label>
            Date Format (Preview + PDF)
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
              <option value="MMM YYYY">MMM YYYY (May 2026)</option>
              <option value="MM/YYYY">MM/YYYY (05/2026)</option>
              <option value="YYYY-MM">YYYY-MM (2026-05)</option>
              <option value="DD MMM YYYY">DD MMM YYYY (06 May 2026)</option>
            </select>
          </label>

          <h3><span className="step">02</span> Programmer Profile</h3>
          <div className="grid">
            <label>
              Languages
              <input value={programmingLanguages} onChange={(e) => setProgrammingLanguages(e.target.value)} placeholder="TypeScript, Python, Go" />
            </label>
            <label>
              Frameworks
              <input value={frameworks} onChange={(e) => setFrameworks(e.target.value)} placeholder="React, FastAPI" />
            </label>
          </div>
          <div className="grid">
            <label>
              Databases
              <input value={databases} onChange={(e) => setDatabases(e.target.value)} placeholder="PostgreSQL, Redis" />
            </label>
            <label>
              Tools
              <input value={tools} onChange={(e) => setTools(e.target.value)} placeholder="Docker, GitHub Actions" />
            </label>
          </div>
          <div className="grid">
            <label>
              GitHub URL
              <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/username" />
            </label>
            <label>
              Portfolio URL
              <input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://portfolio.dev" />
            </label>
          </div>

          <h3><span className="step">03</span> Experience</h3>
          {experiences.map((exp, index) => (
            <section className="experience" key={`exp-${index}`}>
              <div className="writing-heading block-heading">
                <strong>Experience {index + 1}</strong>
                <button
                  type="button"
                  className="enhance-button"
                  disabled={aiBusy !== null}
                  onClick={() => void enhanceWriting(
                    `experience-${index}`,
                    'experience',
                    exp.bullets,
                    `Company: ${exp.company}. Role: ${exp.role}. Target job description: ${jobDescription.slice(0, 4000)}`,
                  )}
                >
                  {aiBusy === `enhance-experience-${index}` ? 'Enhancing…' : '✦ Enhance writing'}
                </button>
              </div>
              <div className="grid">
                <label>
                  Company
                  <input value={exp.company} onChange={(e) => updateExperience(index, 'company', e.target.value)} required />
                </label>
                <label>
                  Role
                  <input value={exp.role} onChange={(e) => updateExperience(index, 'role', e.target.value)} required />
                </label>
              </div>
              <div className="grid">
                <label>
                  Start Date
                  <input type="date" value={exp.startDate} onChange={(e) => updateExperience(index, 'startDate', e.target.value)} required />
                </label>
                <label>
                  End Date
                  <input type="date" value={exp.endDate} onChange={(e) => updateExperience(index, 'endDate', e.target.value)} disabled={exp.currentlyWorking} required={!exp.currentlyWorking} />
                </label>
              </div>
              <label className="inline-checkbox">
                <input type="checkbox" checked={exp.currentlyWorking} onChange={(e) => toggleCurrentlyWorking(index, e.target.checked)} />
                I currently work here
              </label>
              <label>
                Highlights
                <textarea rows={3} value={exp.bullets} onChange={(e) => updateExperience(index, 'bullets', e.target.value)} />
              </label>
              {renderEnhancementReview(`experience-${index}`)}
              <button type="button" className="danger" onClick={() => removeExperience(index)}>Remove Experience</button>
            </section>
          ))}

          <h3><span className="step">04</span> Certifications</h3>
          {certifications.map((cert, index) => (
            <section className="experience" key={`cert-${index}`}>
              <div className="grid">
                <label>
                  Certification Name
                  <input value={cert.name} onChange={(e) => updateCertification(index, 'name', e.target.value)} />
                </label>
                <label>
                  Issuer
                  <input value={cert.issuer} onChange={(e) => updateCertification(index, 'issuer', e.target.value)} />
                </label>
              </div>
              <div className="grid">
                <label>
                  Year
                  <input value={cert.year} onChange={(e) => updateCertification(index, 'year', e.target.value)} />
                </label>
                <label>
                  Credential ID
                  <input value={cert.credentialId} onChange={(e) => updateCertification(index, 'credentialId', e.target.value)} />
                </label>
              </div>
              <button type="button" className="danger" onClick={() => removeCertification(index)}>Remove Certification</button>
            </section>
          ))}

          <div className="actions">
            <button type="button" onClick={addExperience}>Add Experience</button>
            <button type="button" onClick={addCertification}>Add Certification</button>
            <button type="submit">Save Version</button>
          </div>
        </form>

        <aside className="preview-shell" aria-label="Live CV preview">
          <div className="preview-toolbar">
            <div><span className="eyebrow">DOCUMENT PREVIEW</span><h2>Live Preview</h2></div>
            <span><i /> Synced</span>
          </div>
          <div className={`preview-pane preview-${previewPayload.style}`}>
            <div className="preview-header">
              <p className="preview-version">{previewPayload.version_name}</p>
              <h3>{previewPayload.full_name || 'Your Name'}</h3>
              <p className="preview-title">{previewPayload.title || 'Your Title'}</p>

              {(previewPayload.programmer_profile.github_url || previewPayload.programmer_profile.portfolio_url) && (
                <div className="preview-links">
                  {previewPayload.programmer_profile.github_url && <a href={previewPayload.programmer_profile.github_url} target="_blank" rel="noreferrer">GitHub</a>}
                  {previewPayload.programmer_profile.portfolio_url && <a href={previewPayload.programmer_profile.portfolio_url} target="_blank" rel="noreferrer">Portfolio</a>}
                </div>
              )}
            </div>

            <div className="preview-body">
              <section className="preview-section">
                <h4>Professional Summary</h4>
                <p>{previewPayload.summary || 'Your summary will appear here.'}</p>
              </section>

              <section className="preview-section">
                <h4>Programmer Profile</h4>
                <div className="preview-grid">
                  <p><strong>Languages</strong><span>{previewPayload.programmer_profile.programming_languages || '-'}</span></p>
                  <p><strong>Frameworks</strong><span>{previewPayload.programmer_profile.frameworks || '-'}</span></p>
                  <p><strong>Databases</strong><span>{previewPayload.programmer_profile.databases || '-'}</span></p>
                  <p><strong>Tools</strong><span>{previewPayload.programmer_profile.tools || '-'}</span></p>
                </div>
              </section>

              <section className="preview-section">
                <h4>Experience</h4>
                {previewExperiences.map((exp, index) => (
                  <article className="preview-item" key={`pv-exp-${index}`}>
                    <div className="preview-item-heading">
                      <div><p className="preview-item-title">{exp.role || 'Role'}</p><p className="preview-company">{exp.company || 'Company'}</p></div>
                      <p className="preview-item-date">
                        {formatDateValue(exp.start_date, previewPayload.date_format)} - {formatDateValue(exp.end_date, previewPayload.date_format)}
                      </p>
                    </div>
                    <p className="preview-bullet">{exp.bullets || 'Add an achievement with a measurable result.'}</p>
                  </article>
                ))}
              </section>

              <section className="preview-section">
                <h4>Certifications</h4>
                {previewPayload.certifications.length === 0 ? <p className="empty-note">Add a certification to show it here.</p> : previewPayload.certifications.map((cert, index) => (
                  <article className="preview-item certification-item" key={`pv-cert-${index}`}>
                    <div><p className="preview-item-title">{cert.name}</p><p>{cert.issuer}</p></div>
                    <div><p className="preview-item-date">{cert.year}</p>{cert.credential_id ? <p className="credential">ID: {cert.credential_id}</p> : null}</div>
                  </article>
                ))}
              </section>
            </div>
          </div>
        </aside>
      </section>

        </>
      )}

      {statusMessage ? <p className="status" role="status" aria-live="polite">{statusMessage}</p> : null}
    </main>
  )
}

export default App

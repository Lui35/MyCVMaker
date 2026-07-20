import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiBlob, apiJson, errorText } from './api/client'
import { AIStudio } from './components/AIStudio'
import { CVEditor } from './components/CVEditor'
import { CVPreview } from './components/CVPreview'
import { ExportDialog } from './components/ExportDialog'
import { ProfileTab } from './components/ProfileTab'
import { VersionManager } from './components/VersionManager'
import { emptyCertification, emptyEducation, emptyExperience, PRESENT_VALUES, safePdfName } from './cvUtils'
import { useCvVersions } from './hooks/useCvVersions'
import type {
  Certification, CVPayload, EditableCVRecord, Education, Experience, ImportResult, PDFExportOptions,
  SectionSuggestion, TailorResult,
} from './types'
import './App.css'

type EditorTextField = 'versionName' | 'fullName' | 'title' | 'summary' | 'programmingLanguages' | 'frameworks' | 'databases' | 'tools' | 'githubUrl' | 'portfolioUrl'
type ExportRequest = { payload: CVPayload; suggestedName: string }

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('cv-maker-theme') === 'dark')
  const [activeView, setActiveView] = useState<'editor' | 'profile' | 'manage'>('editor')
  const [statusMessage, setStatusMessage] = useState('')
  const [currentCvId, setCurrentCvId] = useState<string | null>(null)
  const { versions, refresh, load, save, duplicate, setDefault, remove } = useCvVersions()

  const [versionName, setVersionName] = useState('My CV')
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [programmingLanguages, setProgrammingLanguages] = useState('')
  const [frameworks, setFrameworks] = useState('')
  const [databases, setDatabases] = useState('')
  const [tools, setTools] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [experiences, setExperiences] = useState<Experience[]>([emptyExperience()])
  const [certifications, setCertifications] = useState<Certification[]>([emptyCertification()])
  const [education, setEducation] = useState<Education[]>([emptyEducation()])

  const [importFile, setImportFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [aiBusy, setAiBusy] = useState<string | null>(null)
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null)
  const [confirmedGapSuggestions, setConfirmedGapSuggestions] = useState<number[]>([])
  const [sectionSuggestion, setSectionSuggestion] = useState<SectionSuggestion | null>(null)
  const [exportRequest, setExportRequest] = useState<ExportRequest | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const toPayload = (): CVPayload => ({
    version_name: versionName,
    full_name: fullName,
    title,
    summary,
    style: 'classic',
    date_format: 'MMM YYYY',
    programmer_profile: {
      programming_languages: programmingLanguages, frameworks, databases, tools,
      github_url: githubUrl, portfolio_url: portfolioUrl,
    },
    contact_profile: { email, phone, location, linkedin_url: linkedinUrl },
    certifications: certifications.filter((item) => item.name && item.issuer && item.year).map((item) => ({
      name: item.name, issuer: item.issuer, year: item.year, credential_id: item.credentialId,
    })),
    experiences: experiences
      .filter((item) => item.company.trim() && item.role.trim() && item.startDate && (item.currentlyWorking || item.endDate))
      .map((item) => ({
        company: item.company, role: item.role, start_date: item.startDate,
        end_date: item.currentlyWorking ? 'Present' : item.endDate, bullets: item.bullets,
      })),
    education: education.filter((item) => item.institution.trim() && item.degree.trim()).map((item) => ({
      institution: item.institution,
      degree: item.degree,
      field_of_study: item.fieldOfStudy,
      start_date: item.startDate,
      end_date: item.endDate,
      details: item.details,
    })),
  })

  const applyCvData = (cv: EditableCVRecord) => {
    setCurrentCvId(cv.id ?? null)
    setVersionName(cv.version_name ?? 'My CV')
    setFullName(cv.full_name ?? '')
    setTitle(cv.title ?? '')
    setSummary(cv.summary ?? '')
    setProgrammingLanguages(cv.programmer_profile?.programming_languages ?? '')
    setFrameworks(cv.programmer_profile?.frameworks ?? '')
    setDatabases(cv.programmer_profile?.databases ?? '')
    setTools(cv.programmer_profile?.tools ?? '')
    setGithubUrl(cv.programmer_profile?.github_url ?? '')
    setPortfolioUrl(cv.programmer_profile?.portfolio_url ?? '')
    setEmail(cv.contact_profile?.email ?? '')
    setPhone(cv.contact_profile?.phone ?? '')
    setLocation(cv.contact_profile?.location ?? '')
    setLinkedinUrl(cv.contact_profile?.linkedin_url ?? '')
    const mappedExperiences = (cv.experiences ?? []).map((item) => {
      const current = PRESENT_VALUES.has(String(item.end_date ?? '').toLowerCase())
      return { company: item.company ?? '', role: item.role ?? '', startDate: item.start_date ?? '', endDate: current ? '' : (item.end_date ?? ''), currentlyWorking: current, bullets: item.bullets ?? '' }
    })
    setExperiences(mappedExperiences.length ? mappedExperiences : [emptyExperience()])
    const mappedCertifications = (cv.certifications ?? []).map((item) => ({ name: item.name ?? '', issuer: item.issuer ?? '', year: item.year ?? '', credentialId: item.credential_id ?? '' }))
    setCertifications(mappedCertifications.length ? mappedCertifications : [emptyCertification()])
    const mappedEducation = (cv.education ?? []).map((item) => ({
      institution: item.institution ?? '', degree: item.degree ?? '', fieldOfStudy: item.field_of_study ?? '',
      startDate: item.start_date ?? '', endDate: item.end_date ?? '', details: item.details ?? '',
    }))
    setEducation(mappedEducation.length ? mappedEducation : [emptyEducation()])
  }

  const showError = (error: unknown, fallback: string) => setStatusMessage(errorText(error, fallback))

  const loadCv = async (cvId: string) => {
    try { applyCvData(await load(cvId)) } catch (error) { showError(error, 'Could not load the selected CV.') }
  }

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const list = await refresh()
        if (!list.length) return
        const preferred = list.find((item) => item.is_default) ?? list[0]
        applyCvData(await load(preferred.id))
      } catch (error) {
        showError(error, 'The editor is ready, but saved versions are unavailable.')
      }
    }
    void bootstrap()
  }, [load, refresh])

  useEffect(() => { localStorage.setItem('cv-maker-theme', isDarkMode ? 'dark' : 'light') }, [isDarkMode])

  const clearFormForNew = () => {
    setCurrentCvId(null); setVersionName('New CV'); setFullName(''); setTitle(''); setSummary('')
    setProgrammingLanguages(''); setFrameworks(''); setDatabases(''); setTools(''); setGithubUrl(''); setPortfolioUrl('')
    setEmail(''); setPhone(''); setLocation(''); setLinkedinUrl('')
    setExperiences([emptyExperience()]); setCertifications([emptyCertification()]); setEducation([emptyEducation()]); setStatusMessage('Started a new CV version.')
  }

  const changeText = (field: EditorTextField, value: string) => {
    const setters: Record<EditorTextField, (next: string) => void> = {
      versionName: setVersionName, fullName: setFullName, title: setTitle, summary: setSummary,
      programmingLanguages: setProgrammingLanguages, frameworks: setFrameworks, databases: setDatabases,
      tools: setTools, githubUrl: setGithubUrl, portfolioUrl: setPortfolioUrl,
    }
    setters[field](value)
  }

  const updateExperience = (index: number, field: keyof Experience, value: string) => setExperiences((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  const toggleCurrentlyWorking = (index: number, checked: boolean) => setExperiences((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, currentlyWorking: checked, endDate: checked ? '' : item.endDate } : item))
  const updateCertification = (index: number, field: keyof Certification, value: string) => setCertifications((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  const updateEducation = (index: number, field: keyof Education, value: string) => setEducation((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))

  const changeProfile = (field: 'fullName' | 'email' | 'phone' | 'location' | 'githubUrl' | 'linkedinUrl' | 'portfolioUrl', value: string) => {
    const setters = { fullName: setFullName, email: setEmail, phone: setPhone, location: setLocation, githubUrl: setGithubUrl, linkedinUrl: setLinkedinUrl, portfolioUrl: setPortfolioUrl }
    setters[field](value)
  }

  const saveDraft = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const result = await save(toPayload(), currentCvId)
      setCurrentCvId(result.id)
      setStatusMessage('CV version saved.')
    } catch (error) { showError(error, 'Could not save the CV version.') }
  }

  const saveProfile = async () => {
    if (!fullName.trim()) return setStatusMessage('Add your full name before saving the profile.')
    if (!title.trim() || !summary.trim()) {
      setStatusMessage('Add a professional title and summary in the Editor before saving this CV version.')
      return
    }
    try {
      const result = await save(toPayload(), currentCvId)
      setCurrentCvId(result.id)
      setStatusMessage('Profile and education saved to this CV version.')
    } catch (error) { showError(error, 'Could not save the profile.') }
  }

  const duplicateCurrent = async () => {
    if (!currentCvId) return setStatusMessage('Save this CV before duplicating.')
    try { const result = await duplicate(currentCvId); await loadCv(result.id); setStatusMessage('CV duplicated.') } catch (error) { showError(error, 'Could not duplicate the CV version.') }
  }

  const setCurrentAsDefault = async () => {
    if (!currentCvId) return setStatusMessage('Save this CV before setting it as default.')
    try { await setDefault(currentCvId); setStatusMessage('Default CV updated.') } catch (error) { showError(error, 'Could not set the default CV.') }
  }

  const deleteVersion = async (cvId: string, displayName: string) => {
    if (!window.confirm(`Delete "${displayName}" permanently? This cannot be undone.`)) return
    try {
      const remaining = await remove(cvId)
      if (cvId === currentCvId) {
        if (remaining.length) await loadCv((remaining.find((item) => item.is_default) ?? remaining[0]).id)
        else clearFormForNew()
      }
      setStatusMessage(`Deleted "${displayName}".`)
    } catch (error) { showError(error, 'Could not delete the CV version.') }
  }

  const exportManagedCv = async (cvId: string, displayName: string) => {
    try { setExportRequest({ payload: await load(cvId), suggestedName: displayName }) } catch (error) { showError(error, 'Could not load this CV for export.') }
  }

  const exportPdf = async (cv: CVPayload, options: PDFExportOptions, fileName: string) => {
    setIsExporting(true)
    try {
      const blob = await apiBlob('/generate/pdf', { method: 'POST', body: JSON.stringify({ cv, options }) }, 'Could not generate the PDF.')
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${safePdfName(fileName)}.pdf`; anchor.click()
      window.URL.revokeObjectURL(url)
      setStatusMessage(`Exported ${safePdfName(fileName)}.pdf`)
      setExportRequest(null)
    } catch (error) { showError(error, 'Could not generate the PDF.') } finally { setIsExporting(false) }
  }

  const importCvWithAi = async () => {
    if (!importFile) return setStatusMessage('Choose a PDF, DOCX, or TXT CV first.')
    setAiBusy('import'); setTailorResult(null)
    try {
      const body = new FormData(); body.append('file', importFile)
      const result = await apiJson<ImportResult>('/ai/import-cv', { method: 'POST', body }, 'Could not import this CV.')
      applyCvData(result.cv)
      setStatusMessage(result.warnings.length ? `CV imported. Review these items: ${result.warnings.join(' ')}` : 'CV imported into a new unsaved version. Review it before saving.')
    } catch (error) { showError(error, 'Could not import this CV.') } finally { setAiBusy(null) }
  }

  const tailorCvWithAi = async () => {
    if (jobDescription.trim().length < 80) return setStatusMessage('Paste a fuller job description (at least 80 characters).')
    if (!fullName.trim() || !title.trim() || !summary.trim()) return setStatusMessage('Add your name, title, and summary before tailoring this CV.')
    setAiBusy('tailor'); setConfirmedGapSuggestions([])
    try {
      const result = await apiJson<TailorResult>('/ai/tailor', { method: 'POST', body: JSON.stringify({ cv: toPayload(), job_description: jobDescription }) }, 'Could not tailor this CV.')
      setTailorResult(result); setStatusMessage('AI suggestions are ready for review. Your current CV has not been changed.')
    } catch (error) { showError(error, 'Could not tailor this CV.') } finally { setAiBusy(null) }
  }

  const applyTailoredVersion = () => {
    if (!tailorResult) return
    const tailored: CVPayload = { ...tailorResult.tailored_cv, experiences: tailorResult.tailored_cv.experiences.map((item) => ({ ...item })) }
    confirmedGapSuggestions.forEach((index) => {
      const suggestion = tailorResult.experience_gap_suggestions[index]
      const target = suggestion ? tailored.experiences[suggestion.target_experience_index] : undefined
      if (target) target.bullets = [target.bullets.trim(), suggestion.suggested_bullet.trim()].filter(Boolean).join('\n')
    })
    applyCvData(tailored); setTailorResult(null); setConfirmedGapSuggestions([])
    setStatusMessage('Tailored suggestions applied as a new unsaved CV version.')
  }

  const enhanceWriting = async (key: string, sectionType: 'summary' | 'experience', content: string, context: string) => {
    if (content.trim().length < 20) return setStatusMessage('Add at least 20 characters before enhancing this section.')
    setAiBusy(`enhance-${key}`); setSectionSuggestion(null)
    try {
      const result = await apiJson<Omit<SectionSuggestion, 'key'>>('/ai/enhance-section', { method: 'POST', body: JSON.stringify({ section_type: sectionType, content, context }) }, 'Could not enhance this section.')
      setSectionSuggestion({ key, ...result }); setStatusMessage('Enhanced writing is ready for review. Nothing has been replaced yet.')
    } catch (error) { showError(error, 'Could not enhance this section.') } finally { setAiBusy(null) }
  }

  const applySectionSuggestion = (key: string) => {
    if (!sectionSuggestion || sectionSuggestion.key !== key) return
    if (key === 'summary') setSummary(sectionSuggestion.enhanced_text.slice(0, 500))
    else {
      const index = Number(key.replace('experience-', ''))
      if (Number.isInteger(index) && experiences[index]) updateExperience(index, 'bullets', sectionSuggestion.enhanced_text)
    }
    setSectionSuggestion(null); setStatusMessage('Enhanced writing applied. Review it before saving or exporting.')
  }

  const fillDummyData = () => {
    setVersionName('Senior Developer CV'); setFullName('Alex Johnson'); setTitle('Senior Full-Stack Developer')
    setSummary('Engineer focused on shipping reliable, scalable products with clean architecture and measurable business impact.')
    setProgrammingLanguages('TypeScript, Python, Go, SQL'); setFrameworks('React, FastAPI, Node.js, Express')
    setDatabases('PostgreSQL, SQLite, Redis'); setTools('Docker, GitHub Actions, Terraform, Linux')
    setGithubUrl('https://github.com/alexjohnson'); setPortfolioUrl('https://alexjohnson.dev')
    setEmail('alex.johnson@example.com'); setPhone('+973 3900 0000'); setLocation('Manama, Bahrain'); setLinkedinUrl('https://linkedin.com/in/alexjohnson')
    setExperiences([{ company: 'NovaTech', role: 'Senior Software Engineer', startDate: '2023-02-01', endDate: '', currentlyWorking: true, bullets: 'Led migration to microservices and reduced API latency by 42%.' }, { company: 'CloudLayer', role: 'Software Engineer', startDate: '2020-01-01', endDate: '2023-01-31', currentlyWorking: false, bullets: 'Built internal developer platform and improved reliability to 99.7%.' }])
    setCertifications([{ name: 'AWS Certified Developer - Associate', issuer: 'Amazon Web Services', year: '2024', credentialId: 'AWS-DEV-001122' }, { name: 'Professional Scrum Master I', issuer: 'Scrum.org', year: '2022', credentialId: 'PSM-I-778899' }])
    setEducation([{ institution: 'University of Bahrain', degree: 'Bachelor of Science', fieldOfStudy: 'Computer Science', startDate: '2016-09', endDate: '2020-06', details: 'Coursework in software engineering, databases, and distributed systems.' }])
    setStatusMessage('Dummy data loaded.')
  }

  const previewPayload = toPayload()
  const completionChecks = [Boolean(fullName.trim()), Boolean(email.trim()), Boolean(title.trim()), summary.trim().length >= 80, Boolean(programmingLanguages.trim() || frameworks.trim() || tools.trim()), experiences.some((item) => item.company.trim() && item.role.trim() && item.startDate), experiences.some((item) => item.bullets.trim().length >= 40), Boolean(githubUrl.trim() || linkedinUrl.trim() || portfolioUrl.trim()), education.some((item) => item.institution.trim() && item.degree.trim())]
  const completion = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100)
  const editorValues = { versionName, fullName, title, summary, programmingLanguages, frameworks, databases, tools, githubUrl, portfolioUrl }

  return (
    <main className={`layout ${isDarkMode ? 'dark' : ''}`}>
      <header className="page-header">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">C</span><div><span className="eyebrow">CAREER STUDIO</span><h1>Build a CV that gets read.</h1><p>Shape an ATS-ready story, preview every change, and export with confidence.</p></div></div>
        <div className="topbar"><button type="button" className="ghost" aria-pressed={isDarkMode} onClick={() => setIsDarkMode((value) => !value)}>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</button>{activeView === 'editor' ? <><button type="button" className="ghost" onClick={fillDummyData}>Fill Dummy Data</button><button type="button" className="primary-action" onClick={() => setExportRequest({ payload: toPayload(), suggestedName: versionName })}>Export PDF <span aria-hidden="true">&#8599;</span></button></> : null}</div>
      </header>
      <nav className="workspace-tabs" role="tablist" aria-label="CV workspace"><button type="button" role="tab" aria-selected={activeView === 'profile'} className={activeView === 'profile' ? 'active' : ''} onClick={() => setActiveView('profile')}>Profile</button><button type="button" role="tab" aria-selected={activeView === 'editor'} className={activeView === 'editor' ? 'active' : ''} onClick={() => setActiveView('editor')}>Editor</button><button type="button" role="tab" aria-selected={activeView === 'manage'} className={activeView === 'manage' ? 'active' : ''} onClick={() => setActiveView('manage')}>Manage CVs <span>{versions.length}</span></button></nav>

      {activeView === 'manage' ? (
        <VersionManager versions={versions} currentCvId={currentCvId} onCreate={() => { clearFormForNew(); setActiveView('editor') }} onOpen={(id) => { void loadCv(id); setActiveView('editor') }} onExport={(id, name) => void exportManagedCv(id, name)} onDuplicate={(id, name) => { void duplicate(id).then(() => setStatusMessage(`Duplicated "${name}".`)).catch((error) => showError(error, 'Could not duplicate the CV version.')) }} onSetDefault={(id, name) => { void setDefault(id).then(() => setStatusMessage(`Set "${name}" as the default CV.`)).catch((error) => showError(error, 'Could not set the default CV.')) }} onDelete={(id, name) => void deleteVersion(id, name)} />
      ) : activeView === 'profile' ? (
        <ProfileTab fullName={fullName} email={email} phone={phone} location={location} githubUrl={githubUrl} linkedinUrl={linkedinUrl} portfolioUrl={portfolioUrl} education={education} onChange={changeProfile} onEducationChange={updateEducation} onAddEducation={() => setEducation((items) => [...items, emptyEducation()])} onRemoveEducation={(index) => setEducation((items) => items.length === 1 ? [emptyEducation()] : items.filter((_, itemIndex) => itemIndex !== index))} onSave={() => void saveProfile()} />
      ) : (
        <>
          <section className="version-bar card" aria-label="CV version controls"><label>CV Version<select value={currentCvId ?? ''} onChange={(event) => { if (event.target.value) void loadCv(event.target.value) }}><option value="">New unsaved version</option>{versions.map((item) => <option key={item.id} value={item.id}>{item.version_name}{item.is_default ? ' (Default)' : ''}</option>)}</select></label><div className="actions"><button type="button" onClick={clearFormForNew}>New Version</button><button type="button" onClick={() => void duplicateCurrent()}>Duplicate</button><button type="button" onClick={() => void setCurrentAsDefault()}>Set as Default</button><button type="button" className="delete-version" onClick={() => { if (currentCvId) void deleteVersion(currentCvId, versionName) }} disabled={!currentCvId}>Delete</button></div></section>
          <section className="readiness card" aria-label={`CV readiness ${completion}%`}><div className="readiness-copy"><span className="score">{completion}%</span><span><strong>{completion >= 85 ? 'Strong' : completion >= 55 ? 'Good start' : 'Needs detail'}</strong><small>CV readiness</small></span></div><div className="progress-track"><span style={{ width: `${completion}%` }} /></div><p>{completion < 85 ? 'Add measurable experience highlights and profile links to strengthen your CV.' : 'Your core sections are in great shape and ready for a final review.'}</p></section>
          <AIStudio importFile={importFile} jobDescription={jobDescription} aiBusy={aiBusy} tailorResult={tailorResult} confirmedSuggestions={confirmedGapSuggestions} onImportFileChange={setImportFile} onJobDescriptionChange={setJobDescription} onImport={() => void importCvWithAi()} onTailor={() => void tailorCvWithAi()} onToggleSuggestion={(index, checked) => setConfirmedGapSuggestions((items) => checked ? [...new Set([...items, index])] : items.filter((item) => item !== index))} onDiscard={() => { setTailorResult(null); setConfirmedGapSuggestions([]) }} onApply={applyTailoredVersion} />
          <section className="workspace">
            <CVEditor values={editorValues} experiences={experiences} certifications={certifications} jobDescription={jobDescription} aiBusy={aiBusy} sectionSuggestion={sectionSuggestion} onTextChange={changeText} onExperienceChange={updateExperience} onCurrentWorkChange={toggleCurrentlyWorking} onCertificationChange={updateCertification} onAddExperience={() => setExperiences((items) => [...items, emptyExperience()])} onRemoveExperience={(index) => setExperiences((items) => items.length === 1 ? [emptyExperience()] : items.filter((_, itemIndex) => itemIndex !== index))} onAddCertification={() => setCertifications((items) => [...items, emptyCertification()])} onRemoveCertification={(index) => setCertifications((items) => items.length === 1 ? [emptyCertification()] : items.filter((_, itemIndex) => itemIndex !== index))} onEnhance={(...args) => void enhanceWriting(...args)} onApplySuggestion={applySectionSuggestion} onDiscardSuggestion={() => setSectionSuggestion(null)} onSave={saveDraft} />
            <CVPreview cv={previewPayload} />
          </section>
        </>
      )}

      {exportRequest ? <ExportDialog payload={exportRequest.payload} suggestedName={exportRequest.suggestedName} isExporting={isExporting} onClose={() => { if (!isExporting) setExportRequest(null) }} onExport={exportPdf} /> : null}
      {statusMessage ? <p className="status" role="status" aria-live="polite">{statusMessage}</p> : null}
    </main>
  )
}

export default App

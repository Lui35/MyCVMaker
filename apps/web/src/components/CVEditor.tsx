import type { FormEvent, ReactNode } from 'react'
import type { Certification, Experience, SectionSuggestion } from '../types'

type TextField = 'versionName' | 'fullName' | 'title' | 'summary' | 'programmingLanguages' | 'frameworks' | 'databases' | 'tools' | 'githubUrl' | 'portfolioUrl'

type Props = {
  values: Record<TextField, string>
  experiences: Experience[]
  certifications: Certification[]
  jobDescription: string
  aiBusy: string | null
  sectionSuggestion: SectionSuggestion | null
  onTextChange: (field: TextField, value: string) => void
  onExperienceChange: (index: number, field: keyof Experience, value: string) => void
  onCurrentWorkChange: (index: number, checked: boolean) => void
  onCertificationChange: (index: number, field: keyof Certification, value: string) => void
  onAddExperience: () => void
  onRemoveExperience: (index: number) => void
  onAddCertification: () => void
  onRemoveCertification: (index: number) => void
  onEnhance: (key: string, sectionType: 'summary' | 'experience', content: string, context: string) => void
  onApplySuggestion: (key: string) => void
  onDiscardSuggestion: () => void
  onSave: (event: FormEvent) => void
}

export function CVEditor(props: Props) {
  const { values, experiences, certifications, jobDescription, aiBusy, sectionSuggestion } = props
  const enhancementReview = (key: string): ReactNode => {
    if (!sectionSuggestion || sectionSuggestion.key !== key) return null
    return (
      <div className="enhance-review">
        <div><span className="eyebrow">AI DRAFT - REVIEW BEFORE APPLYING</span><p>{sectionSuggestion.enhanced_text}</p></div>
        {sectionSuggestion.changes.length ? <ul>{sectionSuggestion.changes.map((change) => <li key={change}>{change}</li>)}</ul> : null}
        <div className="enhance-actions"><button type="button" className="ghost" onClick={props.onDiscardSuggestion}>Discard</button><button type="button" onClick={() => props.onApplySuggestion(key)}>Apply draft</button></div>
      </div>
    )
  }

  return (
    <form onSubmit={props.onSave} className="card editor">
      <div className="section-heading editor-heading">
        <div><span className="step">01</span><h2>Editor</h2></div>
        <div className="editor-heading-actions"><p>Focus on content here. Choose presentation options when you export.</p><button type="submit" className="save-version">Save Version</button></div>
      </div>
      <div className="grid">
        <label>Version Name<input value={values.versionName} onChange={(event) => props.onTextChange('versionName', event.target.value)} required /></label>
        <label>Professional title<input value={values.title} onChange={(event) => props.onTextChange('title', event.target.value)} required /></label>
      </div>
      <div className="writing-field">
        <div className="writing-heading">
          <span>Professional Summary <small>{values.summary.length}/500</small></span>
          <button type="button" className="enhance-button" disabled={aiBusy !== null} onClick={() => props.onEnhance('summary', 'summary', values.summary, `Target title: ${values.title}. Existing skills: ${[values.programmingLanguages, values.frameworks, values.databases, values.tools].filter(Boolean).join(', ')}`)}>{aiBusy === 'enhance-summary' ? 'Enhancing…' : '✦ Enhance'}</button>
        </div>
        <label><textarea value={values.summary} onChange={(event) => props.onTextChange('summary', event.target.value.slice(0, 500))} rows={4} placeholder="Summarize your impact, specialties, and years of experience…" required /><small className="field-hint">Aim for 80–300 characters and lead with outcomes.</small></label>
        {enhancementReview('summary')}
      </div>
      <h3><span className="step">02</span> Programmer Profile</h3>
      <div className="grid">
        <label>Languages<input value={values.programmingLanguages} onChange={(event) => props.onTextChange('programmingLanguages', event.target.value)} placeholder="TypeScript, Python, Go" /></label>
        <label>Frameworks<input value={values.frameworks} onChange={(event) => props.onTextChange('frameworks', event.target.value)} placeholder="React, FastAPI" /></label>
      </div>
      <div className="grid">
        <label>Databases<input value={values.databases} onChange={(event) => props.onTextChange('databases', event.target.value)} placeholder="PostgreSQL, Redis" /></label>
        <label>Tools<input value={values.tools} onChange={(event) => props.onTextChange('tools', event.target.value)} placeholder="Docker, GitHub Actions" /></label>
      </div>
      <div className="editor-subsection-heading"><h3><span className="step">03</span> Experience</h3><button type="button" className="section-add" onClick={props.onAddExperience}>+ Add Experience</button></div>
      {experiences.map((experience, index) => (
        <section className="experience" key={`exp-${index}`}>
          <div className="writing-heading block-heading">
            <strong>Experience {index + 1}</strong>
            <button type="button" className="enhance-button" disabled={aiBusy !== null} onClick={() => props.onEnhance(`experience-${index}`, 'experience', experience.bullets, `Company: ${experience.company}. Role: ${experience.role}. Target job description: ${jobDescription.slice(0, 4000)}`)}>{aiBusy === `enhance-experience-${index}` ? 'Enhancing…' : '✦ Enhance writing'}</button>
          </div>
          <div className="grid">
            <label>Company<input value={experience.company} onChange={(event) => props.onExperienceChange(index, 'company', event.target.value)} required /></label>
            <label>Role<input value={experience.role} onChange={(event) => props.onExperienceChange(index, 'role', event.target.value)} required /></label>
          </div>
          <div className="grid">
            <label>Start Date<input type="date" value={experience.startDate} onChange={(event) => props.onExperienceChange(index, 'startDate', event.target.value)} required /></label>
            <label>End Date<input type="date" value={experience.endDate} onChange={(event) => props.onExperienceChange(index, 'endDate', event.target.value)} disabled={experience.currentlyWorking} required={!experience.currentlyWorking} /></label>
          </div>
          <label className="inline-checkbox"><input type="checkbox" checked={experience.currentlyWorking} onChange={(event) => props.onCurrentWorkChange(index, event.target.checked)} />I currently work here</label>
          <label>Highlights<textarea rows={3} value={experience.bullets} onChange={(event) => props.onExperienceChange(index, 'bullets', event.target.value)} /></label>
          {enhancementReview(`experience-${index}`)}
          <button type="button" className="danger" onClick={() => props.onRemoveExperience(index)}>Remove Experience</button>
        </section>
      ))}
      <div className="editor-subsection-heading"><h3><span className="step">04</span> Certifications</h3><button type="button" className="section-add" onClick={props.onAddCertification}>+ Add Certification</button></div>
      {certifications.map((certification, index) => (
        <section className="experience" key={`cert-${index}`}>
          <div className="grid">
            <label>Certification Name<input value={certification.name} onChange={(event) => props.onCertificationChange(index, 'name', event.target.value)} /></label>
            <label>Issuer<input value={certification.issuer} onChange={(event) => props.onCertificationChange(index, 'issuer', event.target.value)} /></label>
          </div>
          <div className="grid">
            <label>Year<input value={certification.year} onChange={(event) => props.onCertificationChange(index, 'year', event.target.value)} /></label>
            <label>Credential ID<input value={certification.credentialId} onChange={(event) => props.onCertificationChange(index, 'credentialId', event.target.value)} /></label>
          </div>
          <button type="button" className="danger" onClick={() => props.onRemoveCertification(index)}>Remove Certification</button>
        </section>
      ))}
    </form>
  )
}

import { formatDateValue, sortExperiencesNewestFirst } from '../cvUtils'
import type { CVPayload, PDFExportOptions } from '../types'

const displayUrl = (value: string) => value.replace(/^https?:\/\//i, '').replace(/\/$/, '')

const splitHighlights = (value: string) => value
  .split(/\r?\n/)
  .map((item) => item.replace(/^[-*•]\s*/, '').trim())
  .filter(Boolean)

export function ExportPreview({ cv, options }: { cv: CVPayload; options: PDFExportOptions }) {
  const experiences = sortExperiencesNewestFirst(cv.experiences)
  const profileItems = [
    ['Languages', cv.programmer_profile.programming_languages],
    ['Frameworks', cv.programmer_profile.frameworks],
    ['Databases', cv.programmer_profile.databases],
    ['Tools', cv.programmer_profile.tools],
  ].filter(([, value]) => value.trim())
  const contactItems = [cv.contact_profile.email, cv.contact_profile.phone, cv.contact_profile.location].filter(Boolean)
  const linkItems = [cv.programmer_profile.github_url, cv.contact_profile.linkedin_url, cv.programmer_profile.portfolio_url].filter(Boolean)

  return (
    <aside className="export-preview-panel" aria-label="Export appearance preview" aria-live="polite">
      <div className="export-preview-toolbar">
        <div><span className="eyebrow">LIVE PREVIEW</span><strong>First page</strong></div>
        <span>{options.page_size === 'LETTER' ? 'US Letter' : 'A4'} · {options.margin} margins</span>
      </div>
      <div className="export-preview-stage">
        <article className={`export-paper export-paper-${cv.style} export-paper-${options.page_size.toLowerCase()} export-margin-${options.margin} export-density-${options.density}`}>
          <header className="export-paper-header">
            {cv.style === 'modern' && <i className="export-header-accent" aria-hidden="true" />}
            <h3>{cv.full_name || 'Your Name'}</h3>
            <p className="export-paper-title">{cv.title || 'Your professional title'}</p>
            {contactItems.length > 0 && <p className="export-paper-contact">{contactItems.join('  |  ')}</p>}
            {linkItems.length > 0 && <p className="export-paper-links">{linkItems.map(displayUrl).join('  |  ')}</p>}
          </header>

          <div className="export-paper-body">
            <section><h4>Professional Summary</h4><p>{cv.summary || 'Your professional summary will appear here.'}</p></section>

            {cv.education.length > 0 && (
              <section><h4>Education</h4>{cv.education.map((item, index) => (
                <article className="export-paper-item" key={`export-education-${index}`}>
                  <div><strong>{item.degree}{item.field_of_study ? ` in ${item.field_of_study}` : ''}</strong><time>{formatDateValue(item.start_date, cv.date_format)} - {formatDateValue(item.end_date, cv.date_format)}</time></div>
                  <b>{item.institution}</b>
                  {item.details && <p>{item.details}</p>}
                </article>
              ))}</section>
            )}

            {profileItems.length > 0 && (
              <section><h4>Technical Profile</h4><div className="export-paper-skills">{profileItems.map(([label, value]) => <p key={label}><strong>{label}</strong><span>{value}</span></p>)}</div></section>
            )}

            {experiences.length > 0 && (
              <section><h4>Experience</h4>{experiences.map((experience, index) => (
                <article className="export-paper-item" key={`export-experience-${index}`}>
                  <div><strong>{experience.role || 'Role'}</strong><time>{formatDateValue(experience.start_date, cv.date_format)} - {formatDateValue(experience.end_date, cv.date_format)}</time></div>
                  <b>{experience.company || 'Company'}</b>
                  {splitHighlights(experience.bullets).map((highlight, highlightIndex) => <p className="export-paper-bullet" key={`export-highlight-${highlightIndex}`}>{highlight}</p>)}
                </article>
              ))}</section>
            )}

            {cv.certifications.length > 0 && (
              <section><h4>Certifications</h4>{cv.certifications.map((item, index) => (
                <article className="export-paper-item export-paper-certification" key={`export-certification-${index}`}>
                  <div><strong>{item.name}</strong><time>{item.year}</time></div>
                  <p>{item.issuer}{item.credential_id ? ` | Credential ID: ${item.credential_id}` : ''}</p>
                </article>
              ))}</section>
            )}
          </div>
          <footer><span>{cv.full_name || 'Your Name'}</span><span>01</span></footer>
        </article>
      </div>
      <p className="export-preview-note">The preview follows your selected layout. Final page breaks and links are applied when the PDF is generated.</p>
    </aside>
  )
}

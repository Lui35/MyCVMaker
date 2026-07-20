import { formatDateValue, sortExperiencesNewestFirst } from '../cvUtils'
import type { CVPayload } from '../types'

export function CVPreview({ cv }: { cv: CVPayload }) {
  const experiences = sortExperiencesNewestFirst(cv.experiences)
  return (
    <aside className="preview-shell" aria-label="Live CV preview">
      <div className="preview-toolbar">
        <div><span className="eyebrow">DOCUMENT PREVIEW</span><h2>Live Preview</h2></div>
        <span><i /> Synced</span>
      </div>
      <div className="preview-pane">
        <div className="preview-header">
          <p className="preview-version">{cv.version_name}</p>
          <h3>{cv.full_name || 'Your Name'}</h3>
          <p className="preview-title">{cv.title || 'Your Title'}</p>
          {(cv.contact_profile.email || cv.contact_profile.phone || cv.contact_profile.location) && (
            <div className="preview-contact">
              {cv.contact_profile.email && <a href={`mailto:${cv.contact_profile.email}`}>{cv.contact_profile.email}</a>}
              {cv.contact_profile.phone && <a href={`tel:${cv.contact_profile.phone}`}>{cv.contact_profile.phone}</a>}
              {cv.contact_profile.location && <span>{cv.contact_profile.location}</span>}
            </div>
          )}
          {(cv.programmer_profile.github_url || cv.contact_profile.linkedin_url || cv.programmer_profile.portfolio_url) && (
            <div className="preview-links">
              {cv.programmer_profile.github_url && <a href={cv.programmer_profile.github_url} target="_blank" rel="noreferrer">GitHub</a>}
              {cv.contact_profile.linkedin_url && <a href={cv.contact_profile.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}
              {cv.programmer_profile.portfolio_url && <a href={cv.programmer_profile.portfolio_url} target="_blank" rel="noreferrer">Portfolio</a>}
            </div>
          )}
        </div>
        <div className="preview-body">
          <section className="preview-section"><h4>Professional Summary</h4><p>{cv.summary || 'Your summary will appear here.'}</p></section>
          <section className="preview-section">
            <h4>Education</h4>
            {cv.education.length === 0 ? <p className="empty-note">Add education from the Profile tab to show it here.</p> : cv.education.map((item, index) => (
              <article className="preview-item" key={`pv-education-${index}`}>
                <div className="preview-item-heading">
                  <div><p className="preview-item-title">{item.degree}{item.field_of_study ? ` in ${item.field_of_study}` : ''}</p><p className="preview-company">{item.institution}</p></div>
                  {(item.start_date || item.end_date) && <p className="preview-item-date">{item.start_date || '?'} - {item.end_date || 'Present'}</p>}
                </div>
                {item.details && <p className="preview-bullet">{item.details}</p>}
              </article>
            ))}
          </section>
          <section className="preview-section">
            <h4>Programmer Profile</h4>
            <div className="preview-grid">
              <p><strong>Languages</strong><span>{cv.programmer_profile.programming_languages || '-'}</span></p>
              <p><strong>Frameworks</strong><span>{cv.programmer_profile.frameworks || '-'}</span></p>
              <p><strong>Databases</strong><span>{cv.programmer_profile.databases || '-'}</span></p>
              <p><strong>Tools</strong><span>{cv.programmer_profile.tools || '-'}</span></p>
            </div>
          </section>
          <section className="preview-section">
            <h4>Experience</h4>
            {experiences.map((experience, index) => (
              <article className="preview-item" key={`pv-exp-${index}`}>
                <div className="preview-item-heading">
                  <div><p className="preview-item-title">{experience.role || 'Role'}</p><p className="preview-company">{experience.company || 'Company'}</p></div>
                  <p className="preview-item-date">{formatDateValue(experience.start_date, cv.date_format)} - {formatDateValue(experience.end_date, cv.date_format)}</p>
                </div>
                <p className="preview-bullet">{experience.bullets || 'Add an achievement with a measurable result.'}</p>
              </article>
            ))}
          </section>
          <section className="preview-section">
            <h4>Certifications</h4>
            {cv.certifications.length === 0 ? <p className="empty-note">Add a certification to show it here.</p> : cv.certifications.map((certification, index) => (
              <article className="preview-item certification-item" key={`pv-cert-${index}`}>
                <div><p className="preview-item-title">{certification.name}</p><p>{certification.issuer}</p></div>
                <div><p className="preview-item-date">{certification.year}</p>{certification.credential_id ? <p className="credential">ID: {certification.credential_id}</p> : null}</div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </aside>
  )
}

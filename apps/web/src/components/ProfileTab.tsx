import type { Education } from '../types'

type Props = {
  fullName: string
  email: string
  phone: string
  location: string
  githubUrl: string
  linkedinUrl: string
  portfolioUrl: string
  education: Education[]
  onChange: (field: 'fullName' | 'email' | 'phone' | 'location' | 'githubUrl' | 'linkedinUrl' | 'portfolioUrl', value: string) => void
  onEducationChange: (index: number, field: keyof Education, value: string) => void
  onAddEducation: () => void
  onRemoveEducation: (index: number) => void
  onSave: () => void
}

export function ProfileTab(props: Props) {
  return (
    <section className="profile-page card" role="tabpanel" aria-labelledby="profile-title">
      <div className="profile-heading">
        <div><span className="eyebrow">PERSONAL PROFILE</span><h2 id="profile-title">Your contact and education</h2><p>These details are included in the current CV version and its exported PDF.</p></div>
        <button type="button" onClick={props.onSave}>Save Profile</button>
      </div>

      <section className="profile-section" aria-labelledby="contact-title">
        <div className="profile-section-heading"><div><span className="step">01</span><div><h3 id="contact-title">Contact information</h3><p>Use professional details that recruiters can safely contact.</p></div></div></div>
        <div className="grid">
          <label>Full name<input value={props.fullName} onChange={(event) => props.onChange('fullName', event.target.value)} placeholder="Alex Johnson" required /></label>
          <label>Email<input type="email" value={props.email} onChange={(event) => props.onChange('email', event.target.value)} placeholder="alex@example.com" /></label>
          <label>Phone<input type="tel" value={props.phone} onChange={(event) => props.onChange('phone', event.target.value)} placeholder="+973 0000 0000" /></label>
          <label>Location<input value={props.location} onChange={(event) => props.onChange('location', event.target.value)} placeholder="Manama, Bahrain" /></label>
        </div>
        <div className="grid">
          <label>GitHub URL<input type="url" value={props.githubUrl} onChange={(event) => props.onChange('githubUrl', event.target.value)} placeholder="https://github.com/username" /></label>
          <label>LinkedIn URL<input type="url" value={props.linkedinUrl} onChange={(event) => props.onChange('linkedinUrl', event.target.value)} placeholder="https://linkedin.com/in/username" /></label>
        </div>
        <div className="grid single-feature"><label>Portfolio or personal website<input type="url" value={props.portfolioUrl} onChange={(event) => props.onChange('portfolioUrl', event.target.value)} placeholder="https://yourname.dev" /></label></div>
      </section>

      <section className="profile-section" aria-labelledby="education-title">
        <div className="profile-section-heading">
          <div><span className="step">02</span><div><h3 id="education-title">Education</h3><p>Add degrees, diplomas, bootcamps, or other relevant formal study.</p></div></div>
          <button type="button" className="section-add" onClick={props.onAddEducation}>+ Add Education</button>
        </div>
        <div className="education-list">
          {props.education.map((item, index) => (
            <article className="experience education-card" key={`education-${index}`}>
              <div className="education-card-heading"><strong>Education {index + 1}</strong><button type="button" className="danger" onClick={() => props.onRemoveEducation(index)}>Remove</button></div>
              <div className="grid">
                <label>Institution<input value={item.institution} onChange={(event) => props.onEducationChange(index, 'institution', event.target.value)} placeholder="University or school" /></label>
                <label>Degree or qualification<input value={item.degree} onChange={(event) => props.onEducationChange(index, 'degree', event.target.value)} placeholder="Bachelor of Science" /></label>
              </div>
              <div className="grid single-feature"><label>Field of study<input value={item.fieldOfStudy} onChange={(event) => props.onEducationChange(index, 'fieldOfStudy', event.target.value)} placeholder="Computer Science" /></label></div>
              <div className="grid">
                <label>Start date<input type="month" value={item.startDate} onChange={(event) => props.onEducationChange(index, 'startDate', event.target.value)} /></label>
                <label>End date<input type="month" value={item.endDate} onChange={(event) => props.onEducationChange(index, 'endDate', event.target.value)} /></label>
              </div>
              <label>Relevant details<textarea rows={3} value={item.details} onChange={(event) => props.onEducationChange(index, 'details', event.target.value)} placeholder="Honours, relevant coursework, activities, or achievements…" /></label>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

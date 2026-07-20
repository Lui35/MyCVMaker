import type { CVVersionSummary } from '../types'

type Props = {
  versions: CVVersionSummary[]
  currentCvId: string | null
  onCreate: () => void
  onOpen: (id: string) => void
  onExport: (id: string, name: string) => void
  onDuplicate: (id: string, name: string) => void
  onSetDefault: (id: string, name: string) => void
  onDelete: (id: string, name: string) => void
}

export function VersionManager({
  versions, currentCvId, onCreate, onOpen, onExport, onDuplicate, onSetDefault, onDelete,
}: Props) {
  return (
    <section className="cv-manager card" role="tabpanel" aria-labelledby="manage-cvs-title">
      <div className="manager-heading">
        <div><span className="eyebrow">SAVED VERSIONS</span><h2 id="manage-cvs-title">Manage CVs</h2><p>Open, duplicate, prioritize, or remove your saved CV versions.</p></div>
        <button type="button" onClick={onCreate}>Create new CV</button>
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
                <button type="button" onClick={() => onOpen(version.id)}>Open</button>
                <button type="button" className="download-version" onClick={() => onExport(version.id, version.version_name)}>Export PDF</button>
                <button type="button" className="ghost" onClick={() => onDuplicate(version.id, version.version_name)}>Duplicate</button>
                <button type="button" className="ghost" onClick={() => onSetDefault(version.id, version.version_name)} disabled={version.is_default}>Set default</button>
                <button type="button" className="manager-delete" onClick={() => onDelete(version.id, version.version_name)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="manager-empty"><strong>No saved CVs yet</strong><p>Create and save your first CV to manage it here.</p></div>
      )}
    </section>
  )
}

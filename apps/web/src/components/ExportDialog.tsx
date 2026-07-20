import { useState } from 'react'
import type { FormEvent } from 'react'
import { CV_STYLES, safePdfName } from '../cvUtils'
import type { CVPayload, DateFormat, Density, MarginSize, PageSize, PDFExportOptions } from '../types'
import { ExportPreview } from './ExportPreview'

type Props = {
  payload: CVPayload
  suggestedName: string
  isExporting: boolean
  onClose: () => void
  onExport: (cv: CVPayload, options: PDFExportOptions, fileName: string) => Promise<void>
}

export function ExportDialog({ payload, suggestedName, isExporting, onClose, onExport }: Props) {
  const [style, setStyle] = useState('classic')
  const [dateFormat, setDateFormat] = useState<DateFormat>('MMM YYYY')
  const [fileName, setFileName] = useState(() => safePdfName(suggestedName || payload.full_name || 'cv'))
  const [pageSize, setPageSize] = useState<PageSize>('A4')
  const [margin, setMargin] = useState<MarginSize>('standard')
  const [density, setDensity] = useState<Density>('standard')
  const previewPayload = { ...payload, style, date_format: dateFormat }
  const previewOptions: PDFExportOptions = { page_size: pageSize, margin, density }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void onExport(
      { ...payload, style, date_format: dateFormat },
      { page_size: pageSize, margin, density },
      fileName,
    )
  }

  return (
    <div className="export-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isExporting) onClose() }} onKeyDown={(event) => { if (event.key === 'Escape' && !isExporting) onClose() }}>
      <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
        <form onSubmit={submit}>
          <div className="export-heading">
            <div><span className="eyebrow">EXPORT OPTIONS</span><h2 id="export-dialog-title">Prepare your PDF</h2><p>Presentation choices apply only to this export and do not change your CV content.</p></div>
            <button type="button" className="dialog-close" aria-label="Close export options" onClick={onClose} disabled={isExporting}>×</button>
          </div>
          <div className="export-dialog-layout">
            <div className="export-controls">
              <fieldset className="style-fieldset export-style-fieldset">
                <legend>Template</legend>
                <div className="style-picker">
                  {CV_STYLES.map((option) => (
                    <label className={`style-option ${style === option.id ? 'selected' : ''}`} key={option.id}>
                      <input type="radio" name="export-style" value={option.id} checked={style === option.id} onChange={(event) => setStyle(event.target.value)} />
                      <span className={`style-swatch ${option.swatch}`} aria-hidden="true"><i /><i /><i /></span>
                      <span><strong>{option.name}</strong><small>{option.description}</small></span>
                      <b aria-hidden="true">{style === option.id ? '✓' : ''}</b>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid export-fields">
                <label>Date format<select value={dateFormat} onChange={(event) => setDateFormat(event.target.value as DateFormat)}><option value="MMM YYYY">MMM YYYY (May 2026)</option><option value="MM/YYYY">MM/YYYY (05/2026)</option><option value="YYYY-MM">YYYY-MM (2026-05)</option><option value="DD MMM YYYY">DD MMM YYYY (06 May 2026)</option></select></label>
                <label>Page size<select value={pageSize} onChange={(event) => setPageSize(event.target.value as PageSize)}><option value="A4">A4</option><option value="LETTER">US Letter</option></select></label>
                <label>Margins<select value={margin} onChange={(event) => setMargin(event.target.value as MarginSize)}><option value="compact">Compact</option><option value="standard">Standard</option><option value="wide">Wide</option></select></label>
                <label>Content density<select value={density} onChange={(event) => setDensity(event.target.value as Density)}><option value="compact">Compact</option><option value="standard">Standard</option><option value="comfortable">Comfortable</option></select></label>
              </div>
              <label>File name<span className="filename-field"><input autoFocus value={fileName} onChange={(event) => setFileName(event.target.value)} required /><span>.pdf</span></span></label>
              <div className="export-summary"><span>Exporting</span><strong>{payload.full_name || 'Untitled CV'}</strong><small>{CV_STYLES.find((option) => option.id === style)?.name} · {pageSize} · {density}</small></div>
              <div className="export-actions"><button type="button" className="ghost" onClick={onClose} disabled={isExporting}>Cancel</button><button type="submit" disabled={isExporting}>{isExporting ? 'Generating PDF…' : 'Export PDF'}</button></div>
            </div>
            <ExportPreview cv={previewPayload} options={previewOptions} />
          </div>
        </form>
      </section>
    </div>
  )
}

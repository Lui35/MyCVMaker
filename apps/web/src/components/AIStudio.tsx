import type { TailorResult } from '../types'

type Props = {
  importFile: File | null
  jobDescription: string
  aiBusy: string | null
  tailorResult: TailorResult | null
  confirmedSuggestions: number[]
  onImportFileChange: (file: File | null) => void
  onJobDescriptionChange: (value: string) => void
  onImport: () => void
  onTailor: () => void
  onToggleSuggestion: (index: number, checked: boolean) => void
  onDiscard: () => void
  onApply: () => void
}

export function AIStudio(props: Props) {
  const { importFile, jobDescription, aiBusy, tailorResult, confirmedSuggestions } = props
  return (
    <section className="ai-studio card" aria-labelledby="ai-studio-title">
      <div className="ai-studio-heading"><div className="ai-title-group"><span className="ai-mark" aria-hidden="true">AI</span><div><span className="eyebrow">GROQ-POWERED WORKSPACE</span><h2 id="ai-studio-title">AI Career Studio</h2></div></div><p>AI suggestions are drafts. Review every fact before saving or exporting.</p></div>
      <div className="ai-grid">
        <article className="ai-tool">
          <span className="tool-number">01</span><div><h3>Import an existing CV</h3><p>Turn a PDF, DOCX, or text CV into editable fields.</p></div>
          <label className="file-picker"><span>{importFile ? importFile.name : 'Choose CV file'}</span><small>PDF, DOCX, or TXT · up to 8 MB</small><input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => props.onImportFileChange(event.target.files?.[0] ?? null)} /></label>
          <button type="button" onClick={props.onImport} disabled={aiBusy !== null}>{aiBusy === 'import' ? 'Importing…' : 'Import with AI'}</button>
        </article>
        <article className="ai-tool tailor-tool">
          <span className="tool-number">02</span><div><h3>Tailor to a job</h3><p>Improve relevance without inventing experience or skills.</p></div>
          <label>Job description<textarea rows={5} value={jobDescription} onChange={(event) => props.onJobDescriptionChange(event.target.value.slice(0, 20000))} placeholder="Paste the complete job description here…" /><small className="field-hint">{jobDescription.length.toLocaleString()} / 20,000 characters</small></label>
          <button type="button" onClick={props.onTailor} disabled={aiBusy !== null}>{aiBusy === 'tailor' ? 'Analyzing…' : 'Analyze & tailor'}</button>
        </article>
      </div>
      {tailorResult ? (
        <section className="ai-results" aria-label="AI tailoring results">
          <div className="match-score"><strong>{tailorResult.match_score}%</strong><span>Evidence-based match</span></div>
          <div className="result-column"><h3>Matched keywords</h3><div className="keyword-list positive">{tailorResult.matched_keywords.length ? tailorResult.matched_keywords.map((keyword) => <span key={keyword}>{keyword}</span>) : <small>None identified</small>}</div></div>
          <div className="result-column"><h3>Missing evidence</h3><div className="keyword-list warning">{tailorResult.missing_keywords.length ? tailorResult.missing_keywords.map((keyword) => <span key={keyword}>{keyword}</span>) : <small>No major gaps identified</small>}</div></div>
          <div className="result-notes"><div><h3>Proposed changes</h3><ul>{tailorResult.changes.map((change) => <li key={change}>{change}</li>)}</ul></div>{tailorResult.warnings.length ? <div><h3>Keep in mind</h3><ul>{tailorResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}</div>
          {tailorResult.experience_gap_suggestions.length ? (
            <div className="gap-suggestions">
              <div className="gap-heading"><div><h3>Experience you may want to add</h3><p>These requirements were not found in your CV. Confirm only the statements you have genuinely done.</p></div><span>{confirmedSuggestions.length} confirmed</span></div>
              <div className="gap-list">
                {tailorResult.experience_gap_suggestions.map((suggestion, index) => {
                  const target = tailorResult.tailored_cv.experiences[suggestion.target_experience_index]
                  return (
                    <label className={`gap-option ${confirmedSuggestions.includes(index) ? 'confirmed' : ''}`} key={`${suggestion.requirement}-${index}`}>
                      <input type="checkbox" checked={confirmedSuggestions.includes(index)} onChange={(event) => props.onToggleSuggestion(index, event.target.checked)} />
                      <span><strong>{suggestion.requirement}</strong><small>Add to {target ? `${target.role} at ${target.company}` : 'the selected experience'}</small><em>{suggestion.suggested_bullet}</em><i>Verify: {suggestion.confirmation_note}</i></span>
                    </label>
                  )
                })}
              </div>
            </div>
          ) : null}
          <div className="result-actions"><button type="button" className="ghost" onClick={props.onDiscard}>Discard</button><button type="button" onClick={props.onApply}>Apply as new version{confirmedSuggestions.length ? ` + ${confirmedSuggestions.length} confirmed` : ''}</button></div>
        </section>
      ) : null}
    </section>
  )
}

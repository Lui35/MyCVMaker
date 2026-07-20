export type Experience = {
  company: string
  role: string
  startDate: string
  endDate: string
  currentlyWorking: boolean
  bullets: string
}

export type Certification = {
  name: string
  issuer: string
  year: string
  credentialId: string
}

export type Education = {
  institution: string
  degree: string
  fieldOfStudy: string
  startDate: string
  endDate: string
  details: string
}

export type DateFormat = 'MMM YYYY' | 'MM/YYYY' | 'YYYY-MM' | 'DD MMM YYYY'
export type PageSize = 'A4' | 'LETTER'
export type MarginSize = 'compact' | 'standard' | 'wide'
export type Density = 'compact' | 'standard' | 'comfortable'

export type PDFExportOptions = {
  page_size: PageSize
  margin: MarginSize
  density: Density
}

export type CVPayload = {
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
  contact_profile: {
    email: string
    phone: string
    location: string
    linkedin_url: string
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
  education: Array<{
    institution: string
    degree: string
    field_of_study: string
    start_date: string
    end_date: string
    details: string
  }>
}

export type CVVersionSummary = {
  id: string
  version_name: string
  is_default: boolean
}

export type ApiCVRecord = CVPayload & {
  id: string
  is_default: boolean
}

export type EditableCVRecord = CVPayload & {
  id?: string
  is_default?: boolean
}

export type TailorResult = {
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

export type ImportResult = {
  cv: CVPayload
  warnings: string[]
  source_name: string
}

export type SectionSuggestion = {
  key: string
  enhanced_text: string
  changes: string[]
}

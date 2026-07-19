from typing import Literal

from pydantic import BaseModel, Field


class Experience(BaseModel):
    company: str = Field(min_length=1)
    role: str = Field(min_length=1)
    start_date: str = Field(min_length=1)
    end_date: str = Field(min_length=1)
    bullets: str = ""


class ProgrammerProfile(BaseModel):
    programming_languages: str = ""
    frameworks: str = ""
    databases: str = ""
    tools: str = ""
    github_url: str = ""
    portfolio_url: str = ""


class Certification(BaseModel):
    name: str = Field(min_length=1)
    issuer: str = Field(min_length=1)
    year: str = Field(min_length=1)
    credential_id: str = ""


class CVPayload(BaseModel):
    version_name: str = Field(min_length=1, default="My CV")
    full_name: str = Field(min_length=1)
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    style: str = Field(min_length=1)
    date_format: Literal["MMM YYYY", "MM/YYYY", "YYYY-MM", "DD MMM YYYY"] = "MMM YYYY"
    experiences: list[Experience] = Field(default_factory=list)
    programmer_profile: ProgrammerProfile = Field(default_factory=ProgrammerProfile)
    certifications: list[Certification] = Field(default_factory=list)


class SaveCVResponse(BaseModel):
    id: str


class CVSummary(BaseModel):
    id: str
    version_name: str
    is_default: bool


class AICVPayload(BaseModel):
    version_name: str
    full_name: str
    title: str
    summary: str
    style: Literal["classic", "minimal", "modern"]
    date_format: Literal["MMM YYYY", "MM/YYYY", "YYYY-MM", "DD MMM YYYY"]
    experiences: list[Experience]
    programmer_profile: ProgrammerProfile
    certifications: list[Certification]


class ImportCVResponse(BaseModel):
    cv: AICVPayload
    warnings: list[str]
    source_name: str


class TailorCVRequest(BaseModel):
    cv: CVPayload
    job_description: str = Field(min_length=80, max_length=20_000)


class ExperienceGapSuggestion(BaseModel):
    target_experience_index: int = Field(ge=0)
    requirement: str
    suggested_bullet: str
    confirmation_note: str


class TailorCVResponse(BaseModel):
    tailored_cv: AICVPayload
    match_score: int = Field(ge=0, le=100)
    matched_keywords: list[str]
    missing_keywords: list[str]
    changes: list[str]
    warnings: list[str]
    experience_gap_suggestions: list[ExperienceGapSuggestion]


class EnhanceSectionRequest(BaseModel):
    section_type: Literal["summary", "experience"]
    content: str = Field(min_length=20, max_length=6_000)
    context: str = Field(default="", max_length=6_000)


class EnhanceSectionResponse(BaseModel):
    enhanced_text: str
    changes: list[str]

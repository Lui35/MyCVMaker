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

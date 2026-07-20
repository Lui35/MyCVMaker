import json
import os
from copy import deepcopy
from typing import Any, TypeVar
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, ValidationError

from .models import (
    AICVPayload,
    CVPayload,
    EnhanceSectionResponse,
    ExperienceGapSuggestion,
    TailorCVResponse,
)


GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-20b"
T = TypeVar("T", bound=BaseModel)


class AIServiceError(RuntimeError):
    pass


class TailorAIResult(BaseModel):
    summary: str
    experience_bullets: list[str]
    match_score: int
    matched_keywords: list[str]
    missing_keywords: list[str]
    changes: list[str]
    warnings: list[str]


class GapSuggestionAIResult(BaseModel):
    suggestions: list[str]


class EnhanceAIResult(BaseModel):
    enhanced_text: str
    changes: list[str]


def import_cv_from_text(text: str, source_name: str) -> tuple[AICVPayload, list[str]]:
    system_prompt = """
You extract CVs into a strict JSON structure for an ATS-friendly CV editor.
Rules:
- Use only facts present in the source. Never invent employers, dates, metrics, skills, credentials, or links.
- Return empty strings or empty arrays when information is absent.
- Include only experience entries that have a company, role, start date, and end date. Use Present for a current role.
- Normalize parseable dates to YYYY-MM-DD. If only month/year is known, use the first day of the month. Preserve unparseable dates as written.
- Put separate achievement bullets on separate lines in the bullets string.
- Extract email, phone, location, and LinkedIn into contact_profile when present.
- Extract education entries only when both institution and degree are present.
- Choose classic style and MMM YYYY date format.
- Set version_name to Imported CV.
- Professional summary should be copied or lightly cleaned, not newly invented.
""".strip()
    user_prompt = f"Source file: {source_name}\n\nExtract this CV:\n\n{text}"
    cv = _request_structured(
        model_type=AICVPayload,
        schema_name="imported_cv",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    warnings: list[str] = []
    if not cv.full_name:
        warnings.append("Full name was not confidently detected.")
    if not cv.summary:
        warnings.append("No professional summary was found.")
    if not cv.experiences:
        warnings.append("No complete experience entries were detected.")
    return cv, warnings


def tailor_cv_to_job(cv: CVPayload, job_description: str) -> TailorCVResponse:
    system_prompt = """
You are an evidence-bound CV editor and ATS analyst.
Analyze the supplied CV against the job description and return the requested JSON.
Rules:
- Never add a skill, employer, qualification, responsibility, metric, or achievement that is not already supported by the CV.
- Never turn an activity into a claimed result unless that result is explicitly stated in the original CV.
- Preserve every number and factual qualifier exactly; stronger wording must not change the underlying claim.
- Return a rewritten summary plus exactly one experience_bullets string for every original experience, in the same order.
- Substantially rephrase the professional summary and every experience block to emphasize the responsibilities and outcomes most relevant to the target job. Use equivalent terminology from the job description when it remains truthful.
- Reorder existing bullets within each role by relevance. Do not remove supported achievements merely because they are less relevant.
- The server preserves every CV field other than the rewritten summary and experience bullets.
- Keep language direct and ATS-readable. Avoid hype, first-person pronouns, and keyword stuffing.
- missing_keywords are relevant job keywords not evidenced by the CV; never insert them into the summary or bullets.
- changes must briefly explain material edits.
- warnings must identify important job requirements that the CV cannot honestly claim.
- match_score must reflect evidence in the original CV, not the rewritten wording.
""".strip()
    user_prompt = (
        "ORIGINAL CV JSON:\n"
        f"{cv.model_dump_json()}\n\n"
        "JOB DESCRIPTION:\n"
        f"{job_description}"
    )
    ai_result = _request_structured(
        model_type=TailorAIResult,
        schema_name="cv_tailoring_edits",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    if len(ai_result.experience_bullets) != len(cv.experiences):
        raise AIServiceError("AI returned an unexpected number of experience edits. Please try again.")
    tailored_experiences = [
        experience.model_copy(update={"bullets": bullets})
        for experience, bullets in zip(cv.experiences, ai_result.experience_bullets, strict=True)
    ]
    tailored = AICVPayload(
        version_name=f"{cv.version_name} - Tailored",
        full_name=cv.full_name,
        title=cv.title,
        summary=ai_result.summary,
        style=cv.style if cv.style in {"classic", "minimal", "modern"} else "classic",
        date_format=cv.date_format,
        experiences=tailored_experiences,
        programmer_profile=cv.programmer_profile.model_copy(deep=True),
        certifications=[certification.model_copy(deep=True) for certification in cv.certifications],
        contact_profile=cv.contact_profile.model_copy(deep=True),
        education=[item.model_copy(deep=True) for item in cv.education],
    )
    gap_prompt = """
Find important job requirements that are not evidenced by the CV and return up to 6 review prompts.
Each suggestions item must use exactly this format:
zero-based experience index|||short requirement|||polished draft bullet|||fact the user must confirm
Rules:
- Map each item to the existing experience where it would fit best.
- The draft bullet may mention the missing requirement, because it will only be inserted after user confirmation.
- Do not invent numbers, employers, dates, certifications, or outcomes.
- Use only technologies and requirement details explicitly written in the job description; do not add examples or specific products that the job did not name.
- Do not attach an inferred benefit or outcome to the draft bullet.
- Return an empty suggestions array when there are no meaningful gaps.
""".strip()
    try:
        gap_result = _request_structured(
            model_type=GapSuggestionAIResult,
            schema_name="cv_experience_gap_suggestions",
            messages=[
                {"role": "system", "content": gap_prompt},
                {
                    "role": "user",
                    "content": f"CV JSON:\n{cv.model_dump_json()}\n\nJOB DESCRIPTION:\n{job_description}",
                },
            ],
        )
        raw_gap_suggestions = gap_result.suggestions
    except AIServiceError:
        raw_gap_suggestions = [
            f"0|||{keyword}|||Applied {keyword} in relevant engineering work.|||Confirm that you have practical experience with {keyword}."
            for keyword in ai_result.missing_keywords[:6]
        ] if cv.experiences else []
        if raw_gap_suggestions:
            ai_result.warnings.append("Some optional additions are keyword-based drafts; edit them after confirming they are true.")

    gap_suggestions: list[ExperienceGapSuggestion] = []
    for raw_suggestion in raw_gap_suggestions:
        parts = [part.strip() for part in raw_suggestion.split("|||", 3)]
        if len(parts) != 4:
            continue
        target_value, requirement, bullet, confirmation_note = parts
        try:
            target_index = int(target_value)
        except ValueError:
            continue
        if 0 <= target_index < len(cv.experiences):
            gap_suggestions.append(
                ExperienceGapSuggestion(
                    target_experience_index=target_index,
                    requirement=requirement,
                    suggested_bullet=bullet,
                    confirmation_note=confirmation_note,
                )
            )

    return TailorCVResponse(
        tailored_cv=tailored,
        match_score=max(0, min(100, ai_result.match_score)),
        matched_keywords=ai_result.matched_keywords,
        missing_keywords=ai_result.missing_keywords,
        changes=ai_result.changes,
        warnings=ai_result.warnings,
        experience_gap_suggestions=gap_suggestions,
    )


def enhance_section(section_type: str, content: str, context: str = "") -> EnhanceSectionResponse:
    section_guidance = (
        "Create one concise professional paragraph, ideally 80 to 300 characters."
        if section_type == "summary"
        else "Keep separate achievements on separate lines and begin each with a strong action verb."
    )
    system_prompt = f"""
You are an evidence-bound CV writing editor.
Improve the supplied {section_type} writing for clarity, impact, and ATS readability.
Rules:
- Use only facts, technologies, responsibilities, and metrics present in the supplied text or context.
- Never invent or estimate achievements, numbers, employers, dates, qualifications, or skills.
- Never convert an activity into a claimed outcome unless that outcome is explicitly stated in the original text.
- Supporting context may clarify names and technologies, but it must not become a new achievement claim.
- Preserve the original meaning and all supported specifics.
- Avoid first-person pronouns, hype, generic claims, and keyword stuffing.
- {section_guidance}
- Return enhanced_text plus a short list describing the writing improvements.
""".strip()
    user_prompt = f"ORIGINAL TEXT:\n{content}\n\nSUPPORTING CONTEXT:\n{context or 'None provided'}"
    result = _request_structured(
        model_type=EnhanceAIResult,
        schema_name="enhanced_cv_section",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return EnhanceSectionResponse(enhanced_text=result.enhanced_text, changes=result.changes)


def _request_structured(
    *,
    model_type: type[T],
    schema_name: str,
    messages: list[dict[str, str]],
) -> T:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise AIServiceError("Groq is not configured. Add a rotated GROQ_API_KEY to the server .env file.")

    schema = _strict_schema(model_type.model_json_schema())
    for attempt in range(2):
        attempt_messages = messages
        if attempt:
            attempt_messages = [
                *messages,
                {
                    "role": "system",
                    "content": "Return only valid JSON matching the schema exactly. Check every field type and keep parallel arrays the same length.",
                },
            ]
        payload = {
            "model": os.getenv("GROQ_MODEL", DEFAULT_MODEL),
            "messages": attempt_messages,
            "temperature": 0 if attempt else 0.15,
            "max_completion_tokens": 2500,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                },
            },
        }
        request = Request(
            GROQ_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "MyCVMaker/0.1",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=75) as response:
                response_data = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            try:
                message = json.loads(details).get("error", {}).get("message", details)
            except json.JSONDecodeError:
                message = details
            retryable = "generate json" in message.lower() or "validate json" in message.lower()
            if attempt == 0 and retryable:
                continue
            raise AIServiceError(f"Groq request failed: {message[:1200]}") from exc
        except (URLError, TimeoutError) as exc:
            raise AIServiceError("Could not reach Groq. Check the server network and try again.") from exc

        try:
            content = response_data["choices"][0]["message"]["content"]
            return model_type.model_validate_json(content)
        except (KeyError, IndexError, TypeError, ValidationError, json.JSONDecodeError) as exc:
            if attempt == 0:
                continue
            raise AIServiceError("Groq returned an invalid structured response. Please try again.") from exc

    raise AIServiceError("Groq could not produce a valid structured response. Please try again.")


def _strict_schema(schema: dict[str, Any]) -> dict[str, Any]:
    strict = deepcopy(schema)
    unsupported = {"default", "title", "minimum", "maximum", "minLength", "maxLength"}

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            for key in list(node):
                if key in unsupported:
                    node.pop(key, None)
            properties = node.get("properties")
            if isinstance(properties, dict):
                node["required"] = list(properties.keys())
                node["additionalProperties"] = False
                for property_schema in properties.values():
                    visit(property_schema)
            for key, value in node.items():
                if key != "properties":
                    visit(value)
        elif isinstance(node, list):
            for item in node:
                visit(item)

    visit(strict)
    return strict

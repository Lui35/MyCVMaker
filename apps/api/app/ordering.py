from datetime import datetime

from .models import CVPayload

PRESENT_VALUES = {"present", "current", "now"}


def normalize_payload(payload: CVPayload) -> CVPayload:
    sorted_experiences = sorted(
        payload.experiences,
        key=lambda exp: (_date_rank(exp.end_date), _date_rank(exp.start_date)),
        reverse=True,
    )
    return payload.model_copy(update={"experiences": sorted_experiences})


def _date_rank(value: str) -> tuple[int, int]:
    cleaned = value.strip().lower()
    if cleaned in PRESENT_VALUES:
        return (9999, 12)

    for fmt in ("%Y-%m", "%Y/%m", "%Y"):
        try:
            parsed = datetime.strptime(cleaned, fmt)
            return (parsed.year, parsed.month)
        except ValueError:
            continue

    digits = "".join(ch for ch in cleaned if ch.isdigit())
    if len(digits) >= 4:
        year = int(digits[:4])
        month = int(digits[4:6]) if len(digits) >= 6 else 1
        month = max(1, min(month, 12))
        return (year, month)

    return (0, 0)

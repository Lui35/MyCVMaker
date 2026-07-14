from datetime import datetime
from io import BytesIO

from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

from .models import CVPayload


def generate_cv_pdf(payload: CVPayload) -> bytes:
    theme = _get_theme(payload.style)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    page_width, page_height = A4
    margin = theme["margin"]
    content_width = page_width - (2 * margin)
    y = page_height - margin
    page_number = 1

    def finish_page() -> None:
        pdf.setStrokeColor(theme["accent_soft"])
        pdf.setLineWidth(0.4)
        pdf.line(margin, 12 * mm, page_width - margin, 12 * mm)
        pdf.setFillColor(theme["muted"])
        pdf.setFont("Helvetica", 7.5)
        pdf.drawString(margin, 8.5 * mm, payload.full_name)
        pdf.drawRightString(page_width - margin, 8.5 * mm, f"Page {page_number}")

    def ensure_space(lines_needed: int) -> None:
        nonlocal y, page_number
        if y > 18 * mm + (lines_needed * theme["line_gap"] * mm):
            return
        finish_page()
        pdf.showPage()
        page_number += 1
        y = page_height - 18 * mm
        _draw_page_chrome(pdf, theme, page_width, page_height)

    def draw_line(text: str, *, size: int = 10, bold: bool = False, color=black, indent_mm: float = 0) -> None:
        nonlocal y
        ensure_space(1)
        pdf.setFillColor(color)
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        pdf.drawString(margin + indent_mm * mm, y, text)
        y -= theme["line_gap"] * mm

    def draw_multiline(text: str, *, size: int = 10, color=black, indent_mm: float = 0) -> None:
        available = content_width - indent_mm * mm
        for line in _wrap_text(text, available, "Helvetica", size):
            draw_line(line, size=size, color=color, indent_mm=indent_mm)

    def draw_section(title: str) -> None:
        nonlocal y
        y -= 1.8 * mm
        ensure_space(2)
        pdf.setFillColor(theme["accent"])
        pdf.setFont("Helvetica-Bold", 9.5)
        pdf.drawString(margin, y, title.upper() if theme["section_upper"] else title)
        if theme["section_rule"]:
            pdf.setStrokeColor(theme["accent_soft"])
            pdf.setLineWidth(0.8)
            pdf.line(margin, y - 1.6 * mm, page_width - margin, y - 1.6 * mm)
        y -= 5.2 * mm

    _draw_page_chrome(pdf, theme, page_width, page_height)

    # Header
    if theme["header_fill"]:
        pdf.setFillColor(theme["header_fill"])
        pdf.rect(0, page_height - 39 * mm, page_width, 39 * mm, stroke=0, fill=1)
        y = page_height - 13 * mm
        draw_line(payload.full_name, size=22, bold=True, color=white)
        draw_line(payload.title, size=10.5, color=theme["header_subtext"])
        links = "  |  ".join(filter(None, [payload.programmer_profile.github_url, payload.programmer_profile.portfolio_url]))
        if links:
            draw_line(links, size=8, color=theme["header_subtext"])
        y = page_height - 45 * mm
    else:
        draw_line(payload.full_name, size=22, bold=True, color=theme["accent"])
        draw_line(payload.title, size=10.5, color=theme["muted"])
        links = "  |  ".join(filter(None, [payload.programmer_profile.github_url, payload.programmer_profile.portfolio_url]))
        if links:
            draw_line(links, size=8, color=theme["accent"])
        y -= 1.2 * mm

    draw_section("Professional Summary")
    draw_multiline(payload.summary, size=9.5, color=theme["text"])

    profile_values = [
        ("Programming Languages", payload.programmer_profile.programming_languages),
        ("Frameworks", payload.programmer_profile.frameworks),
        ("Databases", payload.programmer_profile.databases),
        ("Tools", payload.programmer_profile.tools),
    ]
    filled_profile_values = [(label, value.strip()) for label, value in profile_values if value.strip()]
    if filled_profile_values:
        draw_section("Programmer Profile")
        for label, value in filled_profile_values:
            ensure_space(1)
            pdf.setFillColor(theme["muted"])
            pdf.setFont("Helvetica-Bold", 8.5)
            pdf.drawString(margin, y, label.upper())
            pdf.setFillColor(theme["text"])
            pdf.setFont("Helvetica", 9.5)
            pdf.drawString(margin + 48 * mm, y, value)
            y -= theme["line_gap"] * mm

    draw_section("Experience")
    for exp in payload.experiences:
        ensure_space(6)
        pdf.setFillColor(theme["accent"])
        pdf.setFont("Helvetica-Bold", 10.5)
        pdf.drawString(margin, y, exp.role)
        start_label = _format_date(exp.start_date, payload.date_format)
        end_label = _format_date(exp.end_date, payload.date_format)
        pdf.setFillColor(theme["muted"])
        pdf.setFont("Helvetica", 8.5)
        pdf.drawRightString(page_width - margin, y, f"{start_label} - {end_label}")
        y -= 4.4 * mm
        draw_line(exp.company, size=9, bold=True, color=theme["text"])
        for bullet in _explode_bullets(exp.bullets):
            bullet_prefix = "-"
            draw_multiline(
                f"{bullet_prefix} {bullet}",
                size=9.2,
                color=theme["text"],
                indent_mm=2.0,
            )
        y -= 1.2 * mm

    if payload.certifications:
        draw_section("Certifications")
        for cert in payload.certifications:
            ensure_space(4)
            pdf.setFillColor(theme["accent"])
            pdf.setFont("Helvetica-Bold", 9.8)
            pdf.drawString(margin, y, cert.name)
            pdf.setFillColor(theme["muted"])
            pdf.setFont("Helvetica", 8.5)
            pdf.drawRightString(page_width - margin, y, cert.year)
            y -= theme["line_gap"] * mm
            cert_details = cert.issuer
            if cert.credential_id:
                cert_details = f"{cert_details} | Credential ID: {cert.credential_id}"
            draw_multiline(cert_details, size=8.8, color=theme["muted"])
            y -= 0.8 * mm

    finish_page()
    pdf.save()
    return buffer.getvalue()


def _get_theme(style: str) -> dict:
    normalized = style.lower().strip()
    themes = {
        "classic": {
            "margin": 18 * mm,
            "line_gap": 5.0,
            "accent": HexColor("#0f172a"),
            "accent_soft": HexColor("#93a4bb"),
            "text": HexColor("#1e293b"),
            "muted": HexColor("#64748b"),
            "section_upper": True,
            "section_rule": True,
            "header_fill": None,
            "header_subtext": HexColor("#e2e8f0"),
            "page_border": False,
        },
        "minimal": {
            "margin": 20 * mm,
            "line_gap": 5.5,
            "accent": HexColor("#111827"),
            "accent_soft": HexColor("#d1d5db"),
            "text": HexColor("#374151"),
            "muted": HexColor("#6b7280"),
            "section_upper": False,
            "section_rule": False,
            "header_fill": None,
            "header_subtext": HexColor("#e2e8f0"),
            "page_border": False,
        },
        "modern": {
            "margin": 16 * mm,
            "line_gap": 5.0,
            "accent": HexColor("#1d4ed8"),
            "accent_soft": HexColor("#93c5fd"),
            "text": HexColor("#172554"),
            "muted": HexColor("#475569"),
            "section_upper": False,
            "section_rule": True,
            "header_fill": HexColor("#1e40af"),
            "header_subtext": HexColor("#dbeafe"),
            "page_border": True,
        },
    }
    return themes.get(normalized, themes["classic"])


def _draw_page_chrome(pdf: canvas.Canvas, theme: dict, page_width: float, page_height: float) -> None:
    if not theme["page_border"]:
        return
    pdf.setStrokeColor(HexColor("#bfdbfe"))
    pdf.setLineWidth(0.8)
    inset = 7 * mm
    pdf.rect(inset, inset, page_width - (2 * inset), page_height - (2 * inset), stroke=1, fill=0)


def _explode_bullets(text: str) -> list[str]:
    if not text.strip():
        return []
    raw_parts = [part.strip() for part in text.replace("\r", "").split("\n") if part.strip()]
    if len(raw_parts) > 1:
        return raw_parts
    by_semicolon = [part.strip() for part in text.split(";") if part.strip()]
    if len(by_semicolon) > 1:
        return by_semicolon
    return [text.strip()]


def _wrap_text(text: str, max_width: float, font_name: str, font_size: float) -> list[str]:
    words = text.strip().split()
    if not words:
        return [""]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if pdfmetrics.stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _format_date(value: str, date_format: str) -> str:
    cleaned = value.strip()
    lowered = cleaned.lower()
    if lowered in {"present", "current", "now"}:
        return "Present"
    if not cleaned:
        return "-"
    try:
        parsed = datetime.strptime(cleaned, "%Y-%m-%d")
    except ValueError:
        return cleaned

    if date_format == "MM/YYYY":
        return parsed.strftime("%m/%Y")
    if date_format == "YYYY-MM":
        return parsed.strftime("%Y-%m")
    if date_format == "DD MMM YYYY":
        return parsed.strftime("%d %b %Y")
    return parsed.strftime("%b %Y")

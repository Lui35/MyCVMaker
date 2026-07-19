from datetime import datetime
from io import BytesIO

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

from .models import CVPayload


def generate_cv_pdf(payload: CVPayload) -> bytes:
    theme = _get_theme(payload.style)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(f"{payload.full_name} - CV")
    pdf.setAuthor(payload.full_name)
    pdf.setSubject("Curriculum Vitae")

    page_width, page_height = A4
    margin = theme["margin"]
    content_width = page_width - (2 * margin)
    bottom_limit = 19 * mm
    page_number = 1
    y = page_height - margin

    def draw_page_chrome() -> None:
        if theme["style"] == "classic":
            pdf.setFillColor(theme["accent"])
            pdf.rect(0, page_height - 4 * mm, page_width, 4 * mm, stroke=0, fill=1)
        elif theme["style"] == "modern" and page_number > 1:
            pdf.setFillColor(theme["accent"])
            pdf.rect(0, page_height - 6 * mm, page_width, 6 * mm, stroke=0, fill=1)

    def draw_footer() -> None:
        pdf.setStrokeColor(theme["rule"])
        pdf.setLineWidth(0.45)
        pdf.line(margin, 13 * mm, page_width - margin, 13 * mm)
        pdf.setFillColor(theme["muted"])
        pdf.setFont("Helvetica", 7)
        pdf.drawString(margin, 9 * mm, payload.full_name)
        pdf.drawRightString(page_width - margin, 9 * mm, f"{page_number:02d}")

    def new_page() -> None:
        nonlocal y, page_number
        draw_footer()
        pdf.showPage()
        page_number += 1
        draw_page_chrome()
        y = page_height - (15 * mm if theme["style"] == "modern" else margin)

    def ensure_space(height_mm: float) -> None:
        if y - (height_mm * mm) < bottom_limit:
            new_page()

    def wrapped_lines(text: str, width: float, font: str, size: float) -> list[str]:
        return _wrap_text(text, width, font, size)

    def draw_wrapped(
        text: str,
        *,
        x: float = margin,
        width: float = content_width,
        font: str = "Helvetica",
        size: float = 9.2,
        color=None,
        leading_mm: float | None = None,
        prefix: str = "",
        hanging_mm: float = 0,
    ) -> None:
        nonlocal y
        line_gap = leading_mm or theme["body_leading"]
        prefix_width = pdfmetrics.stringWidth(prefix, font, size) if prefix else 0
        lines = wrapped_lines(text, width - prefix_width, font, size)
        ensure_space(max(1, len(lines)) * line_gap)
        pdf.setFont(font, size)
        pdf.setFillColor(color or theme["text"])
        for index, line in enumerate(lines):
            line_x = x
            if index == 0 and prefix:
                pdf.drawString(x, y, prefix)
                line_x += prefix_width
            elif index > 0 and hanging_mm:
                line_x += hanging_mm * mm
            pdf.drawString(line_x, y, line)
            y -= line_gap * mm

    def draw_section(title: str) -> None:
        nonlocal y
        y -= theme["section_before"] * mm
        ensure_space(10)
        if theme["style"] == "classic":
            pdf.setFont("Helvetica-Bold", 8.4)
            pdf.setFillColor(theme["accent"])
            pdf.drawString(margin, y, title.upper())
            title_width = pdfmetrics.stringWidth(title.upper(), "Helvetica-Bold", 8.4)
            pdf.setStrokeColor(theme["rule"])
            pdf.setLineWidth(0.7)
            pdf.line(margin + title_width + 5 * mm, y + 1.1 * mm, page_width - margin, y + 1.1 * mm)
        elif theme["style"] == "minimal":
            pdf.setFont("Helvetica-Bold", 8.2)
            pdf.setFillColor(theme["accent"])
            pdf.drawString(margin, y, title.upper())
        else:
            pdf.setFillColor(theme["accent"])
            pdf.roundRect(margin, y - 1.4 * mm, 3 * mm, 3 * mm, 1 * mm, stroke=0, fill=1)
            pdf.setFont("Helvetica-Bold", 8.7)
            pdf.drawString(margin + 6 * mm, y, title.upper())
            pdf.setStrokeColor(theme["rule"])
            pdf.setLineWidth(0.55)
            pdf.line(margin + 6 * mm, y - 2.2 * mm, page_width - margin, y - 2.2 * mm)
        y -= theme["section_after"] * mm

    draw_page_chrome()

    # Header
    links = "  |  ".join(filter(None, [_display_url(payload.programmer_profile.github_url), _display_url(payload.programmer_profile.portfolio_url)]))
    if theme["style"] == "modern":
        header_height = 38 * mm
        pdf.setFillColor(theme["accent"])
        pdf.rect(0, page_height - header_height, page_width, header_height, stroke=0, fill=1)
        pdf.setFillColor(theme["highlight"])
        pdf.rect(margin, page_height - 14 * mm, 9 * mm, 1.5 * mm, stroke=0, fill=1)
        pdf.setFillColor(white)
        pdf.setFont("Helvetica-Bold", 22)
        pdf.drawString(margin, page_height - 22 * mm, payload.full_name)
        pdf.setFont("Helvetica", 10)
        pdf.setFillColor(theme["header_subtext"])
        pdf.drawString(margin, page_height - 28 * mm, payload.title)
        if links:
            pdf.setFont("Helvetica", 7.5)
            pdf.drawString(margin, page_height - 33 * mm, links)
        y = page_height - header_height - 7 * mm
    elif theme["style"] == "classic":
        pdf.setFillColor(theme["accent"])
        pdf.setFont("Times-Bold", 24)
        pdf.drawString(margin, y, payload.full_name)
        y -= 6.2 * mm
        pdf.setFont("Helvetica-Bold", 9.2)
        pdf.setFillColor(theme["muted"])
        pdf.drawString(margin, y, payload.title.upper())
        if links:
            pdf.setFont("Helvetica", 7.6)
            pdf.setFillColor(theme["accent"])
            pdf.drawRightString(page_width - margin, y, links)
        y -= 4.2 * mm
    else:
        pdf.setFillColor(theme["accent"])
        pdf.setFont("Helvetica-Bold", 21)
        pdf.drawString(margin, y, payload.full_name)
        y -= 6 * mm
        pdf.setFont("Helvetica", 9.5)
        pdf.setFillColor(theme["muted"])
        pdf.drawString(margin, y, payload.title)
        y -= 4.4 * mm
        if links:
            pdf.setFont("Helvetica", 7.4)
            pdf.drawString(margin, y, links)
            y -= 3.6 * mm

    draw_section("Professional Summary")
    draw_wrapped(payload.summary, size=theme["body_size"], leading_mm=theme["body_leading"])

    profile_values = [
        ("Languages", payload.programmer_profile.programming_languages),
        ("Frameworks", payload.programmer_profile.frameworks),
        ("Databases", payload.programmer_profile.databases),
        ("Tools", payload.programmer_profile.tools),
    ]
    filled_profile_values = [(label, value.strip()) for label, value in profile_values if value.strip()]
    if filled_profile_values:
        draw_section("Technical Profile")
        label_width = 36 * mm
        for label, value in filled_profile_values:
            value_lines = wrapped_lines(value, content_width - label_width, "Helvetica", theme["body_size"])
            ensure_space(len(value_lines) * theme["body_leading"])
            pdf.setFont("Helvetica-Bold", 8.0)
            pdf.setFillColor(theme["muted"])
            pdf.drawString(margin, y, label.upper())
            pdf.setFont("Helvetica", theme["body_size"])
            pdf.setFillColor(theme["text"])
            for line_index, line in enumerate(value_lines):
                pdf.drawString(margin + label_width, y, line)
                y -= theme["body_leading"] * mm
                if line_index == 0:
                    continue

    if payload.experiences:
        draw_section("Experience")
        for exp_index, exp in enumerate(payload.experiences):
            bullets = _explode_bullets(exp.bullets)
            ensure_space(14 + min(2, len(bullets)) * theme["body_leading"])
            date_label = f"{_format_date(exp.start_date, payload.date_format)} - {_format_date(exp.end_date, payload.date_format)}"
            role_x = margin + (5 * mm if theme["style"] == "modern" else 0)
            role_width = content_width - 55 * mm
            if theme["style"] == "modern":
                pdf.setFillColor(theme["highlight"])
                pdf.roundRect(margin, y - 1 * mm, 2.4 * mm, 2.4 * mm, .7 * mm, stroke=0, fill=1)
            role_lines = wrapped_lines(exp.role, role_width, "Helvetica-Bold", 10.8)
            pdf.setFont("Helvetica-Bold", 10.8)
            pdf.setFillColor(theme["accent"])
            pdf.drawString(role_x, y, role_lines[0])
            pdf.setFont("Helvetica-Bold" if theme["style"] == "classic" else "Helvetica", 7.8)
            pdf.setFillColor(theme["muted"])
            pdf.drawRightString(page_width - margin, y, date_label)
            y -= 4.5 * mm
            for extra_role_line in role_lines[1:]:
                pdf.setFont("Helvetica-Bold", 10.8)
                pdf.setFillColor(theme["accent"])
                pdf.drawString(role_x, y, extra_role_line)
                y -= 4.5 * mm
            pdf.setFont("Helvetica-Bold", 9.1)
            pdf.setFillColor(theme["text"])
            pdf.drawString(role_x, y, exp.company)
            y -= 4.5 * mm
            for bullet in bullets:
                bullet_indent = 4.5
                draw_wrapped(
                    bullet,
                    x=role_x,
                    width=content_width - (role_x - margin),
                    size=theme["body_size"],
                    leading_mm=theme["body_leading"],
                    prefix="- ",
                    hanging_mm=bullet_indent,
                )
            if exp_index < len(payload.experiences) - 1:
                y -= theme["item_gap"] * mm

    if payload.certifications:
        draw_section("Certifications")
        for cert_index, cert in enumerate(payload.certifications):
            ensure_space(10)
            pdf.setFont("Helvetica-Bold", 9.7)
            pdf.setFillColor(theme["accent"])
            pdf.drawString(margin, y, cert.name)
            pdf.setFont("Helvetica-Bold", 7.8)
            pdf.setFillColor(theme["muted"])
            pdf.drawRightString(page_width - margin, y, cert.year)
            y -= 4.4 * mm
            detail = cert.issuer
            if cert.credential_id:
                detail = f"{detail}  |  Credential ID: {cert.credential_id}"
            draw_wrapped(detail, size=8.8, color=theme["muted"], leading_mm=4.5)
            if cert_index < len(payload.certifications) - 1:
                y -= 1.2 * mm

    draw_footer()
    pdf.save()
    return buffer.getvalue()


def _get_theme(style: str) -> dict:
    themes = {
        "classic": {
            "style": "classic",
            "margin": 19 * mm,
            "accent": HexColor("#17233b"),
            "text": HexColor("#2f3b4d"),
            "muted": HexColor("#69758a"),
            "rule": HexColor("#c8d0db"),
            "highlight": HexColor("#17233b"),
            "header_subtext": white,
            "body_size": 10.0,
            "body_leading": 5.1,
            "section_before": 6.2,
            "section_after": 5.4,
            "item_gap": 3.0,
        },
        "minimal": {
            "style": "minimal",
            "margin": 21 * mm,
            "accent": HexColor("#24282f"),
            "text": HexColor("#3d444e"),
            "muted": HexColor("#7a818c"),
            "rule": HexColor("#d8dce1"),
            "highlight": HexColor("#24282f"),
            "header_subtext": white,
            "body_size": 9.6,
            "body_leading": 4.8,
            "section_before": 5.4,
            "section_after": 4.8,
            "item_gap": 2.5,
        },
        "modern": {
            "style": "modern",
            "margin": 18 * mm,
            "accent": HexColor("#294b9b"),
            "text": HexColor("#26344e"),
            "muted": HexColor("#65728a"),
            "rule": HexColor("#b8c8e8"),
            "highlight": HexColor("#78d9c4"),
            "header_subtext": HexColor("#dfe8ff"),
            "body_size": 9.8,
            "body_leading": 5.0,
            "section_before": 6.0,
            "section_after": 5.5,
            "item_gap": 2.9,
        },
    }
    return themes.get(style.lower().strip(), themes["classic"])


def _explode_bullets(text: str) -> list[str]:
    if not text.strip():
        return []
    raw_parts = [part.strip().lstrip("- ") for part in text.replace("\r", "").split("\n") if part.strip()]
    if len(raw_parts) > 1:
        return raw_parts
    by_semicolon = [part.strip().lstrip("- ") for part in text.split(";") if part.strip()]
    return by_semicolon if len(by_semicolon) > 1 else [text.strip().lstrip("- ")]


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


def _display_url(value: str) -> str:
    return value.strip().removeprefix("https://").removeprefix("http://").rstrip("/")


def _format_date(value: str, date_format: str) -> str:
    cleaned = value.strip()
    if cleaned.lower() in {"present", "current", "now"}:
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

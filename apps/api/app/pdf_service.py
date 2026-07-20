from datetime import datetime
from io import BytesIO
from pathlib import Path

import pymupdf
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from .models import CVPayload, PDFExportOptions


class PDFGenerationError(RuntimeError):
    pass


_FONT_NAMES: dict[str, str] | None = None


def generate_cv_pdf(payload: CVPayload, options: PDFExportOptions | None = None) -> bytes:
    options = options or PDFExportOptions()
    fonts = _register_unicode_fonts()
    regular_font = fonts["regular"]
    bold_font = fonts["bold"]
    heading_font = fonts["heading"]
    theme = _get_theme(payload.style).copy()
    page_size = A4 if options.page_size == "A4" else letter
    margin_mm = {
        "compact": 14,
        "standard": theme["margin"] / mm,
        "wide": 25,
    }[options.margin]
    density_factor = {
        "compact": 0.88,
        "standard": 1.0,
        "comfortable": 1.12,
    }[options.density]
    theme["margin"] = margin_mm * mm
    theme["body_leading"] *= density_factor
    theme["section_before"] *= density_factor
    theme["section_after"] *= density_factor
    theme["item_gap"] *= density_factor
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=page_size)
    pdf.setTitle(f"{payload.full_name} - CV")
    pdf.setAuthor(payload.full_name)
    pdf.setSubject("Curriculum Vitae")

    page_width, page_height = page_size
    margin = theme["margin"]
    content_width = page_width - (2 * margin)
    bottom_limit = max(16, margin_mm - 3) * mm
    page_number = 1
    y = page_height - margin
    contact_items = [
        (payload.contact_profile.email.strip(), f"mailto:{payload.contact_profile.email.strip()}"),
        (payload.contact_profile.phone.strip(), f"tel:{payload.contact_profile.phone.strip().replace(' ', '')}"),
        (payload.contact_profile.location.strip(), None),
    ]
    contact_items = [item for item in contact_items if item[0]]
    link_items = [
        (_display_url(url), _link_target(url))
        for url in [payload.programmer_profile.github_url, payload.contact_profile.linkedin_url, payload.programmer_profile.portfolio_url]
        if url.strip()
    ]

    def draw_inline_items(items: list[tuple[str, str | None]], item_y: float, size: float, color, *, align: str) -> None:
        separator = "  |  "
        total_width = sum(pdfmetrics.stringWidth(label, regular_font, size) for label, _ in items)
        total_width += max(0, len(items) - 1) * pdfmetrics.stringWidth(separator, regular_font, size)
        x = margin if align == "left" else page_width - margin - total_width
        pdf.setFont(regular_font, size)
        pdf.setFillColor(color)
        for index, (label, target) in enumerate(items):
            if index:
                pdf.drawString(x, item_y, separator)
                x += pdfmetrics.stringWidth(separator, regular_font, size)
            width = pdfmetrics.stringWidth(label, regular_font, size)
            pdf.drawString(x, item_y, label)
            if target:
                pdf.linkURL(target, (x, item_y - 1.5 * mm, x + width, item_y + 2.5 * mm), relative=0)
            x += width

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
        pdf.setFont(regular_font, 7)
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
        font: str = regular_font,
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
        block_height_mm = max(1, len(lines)) * line_gap
        usable_height_mm = (page_height - margin - bottom_limit) / mm
        if block_height_mm <= usable_height_mm:
            ensure_space(block_height_mm)
        pdf.setFont(font, size)
        pdf.setFillColor(color or theme["text"])
        for index, line in enumerate(lines):
            if block_height_mm > usable_height_mm:
                ensure_space(line_gap)
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
        ensure_space(theme["section_after"] + (2 * theme["body_leading"]) + 4)
        if theme["style"] == "classic":
            pdf.setFont(bold_font, 8.4)
            pdf.setFillColor(theme["accent"])
            pdf.drawString(margin, y, title.upper())
            title_width = pdfmetrics.stringWidth(title.upper(), bold_font, 8.4)
            pdf.setStrokeColor(theme["rule"])
            pdf.setLineWidth(0.7)
            pdf.line(margin + title_width + 5 * mm, y + 1.1 * mm, page_width - margin, y + 1.1 * mm)
        elif theme["style"] == "minimal":
            pdf.setFont(bold_font, 8.2)
            pdf.setFillColor(theme["accent"])
            pdf.drawString(margin, y, title.upper())
        else:
            pdf.setFillColor(theme["accent"])
            pdf.roundRect(margin, y - 1.4 * mm, 3 * mm, 3 * mm, 1 * mm, stroke=0, fill=1)
            pdf.setFont(bold_font, 8.7)
            pdf.drawString(margin + 6 * mm, y, title.upper())
            pdf.setStrokeColor(theme["rule"])
            pdf.setLineWidth(0.55)
            pdf.line(margin + 6 * mm, y - 2.2 * mm, page_width - margin, y - 2.2 * mm)
        y -= theme["section_after"] * mm

    draw_page_chrome()

    # Header
    links = bool(link_items)
    if theme["style"] == "modern":
        header_height = 45 * mm
        pdf.setFillColor(theme["accent"])
        pdf.rect(0, page_height - header_height, page_width, header_height, stroke=0, fill=1)
        pdf.setFillColor(theme["highlight"])
        pdf.rect(margin, page_height - 14 * mm, 9 * mm, 1.5 * mm, stroke=0, fill=1)
        pdf.setFillColor(white)
        pdf.setFont(bold_font, 22)
        pdf.drawString(margin, page_height - 22 * mm, payload.full_name)
        pdf.setFont(regular_font, 10)
        pdf.setFillColor(theme["header_subtext"])
        pdf.drawString(margin, page_height - 28 * mm, payload.title)
        if contact_items:
            draw_inline_items(contact_items, page_height - 33 * mm, 7.2, theme["header_subtext"], align="left")
        if links:
            draw_inline_items(link_items, page_height - 38 * mm, 7.2, theme["header_subtext"], align="left")
        y = page_height - header_height - 7 * mm
    elif theme["style"] == "classic":
        pdf.setFillColor(theme["accent"])
        pdf.setFont(heading_font, 24)
        pdf.drawString(margin, y, payload.full_name)
        y -= 6.2 * mm
        pdf.setFont(bold_font, 9.2)
        pdf.setFillColor(theme["muted"])
        pdf.drawString(margin, y, payload.title.upper())
        y -= 4.2 * mm
        if contact_items:
            draw_inline_items(contact_items, y, 7.2, theme["muted"], align="left")
            y -= 3.6 * mm
        if links:
            draw_inline_items(link_items, y, 7.3, theme["accent"], align="left")
            y -= 3.6 * mm
    else:
        pdf.setFillColor(theme["accent"])
        pdf.setFont(bold_font, 21)
        pdf.drawString(margin, y, payload.full_name)
        y -= 6 * mm
        pdf.setFont(regular_font, 9.5)
        pdf.setFillColor(theme["muted"])
        pdf.drawString(margin, y, payload.title)
        y -= 4.4 * mm
        if contact_items:
            draw_inline_items(contact_items, y, 7.2, theme["muted"], align="left")
            y -= 3.6 * mm
        if links:
            draw_inline_items(link_items, y, 7.2, theme["accent"], align="left")
            y -= 3.6 * mm

    draw_section("Professional Summary")
    draw_wrapped(payload.summary, size=theme["body_size"], leading_mm=theme["body_leading"])

    if payload.education:
        draw_section("Education")
        for education_index, item in enumerate(payload.education):
            degree_label = item.degree
            if item.field_of_study:
                degree_label = f"{degree_label} in {item.field_of_study}"
            date_parts = [part for part in [_format_date(item.start_date, payload.date_format), _format_date(item.end_date, payload.date_format)] if part != "-"]
            date_label = " - ".join(date_parts)
            degree_width = content_width - (45 * mm if date_label else 0)
            degree_lines = wrapped_lines(degree_label, degree_width, bold_font, 9.8)
            detail_lines = wrapped_lines(item.details, content_width, regular_font, 8.8) if item.details.strip() else []
            ensure_space((len(degree_lines) * 4.5) + 5 + min(2, len(detail_lines)) * theme["body_leading"])
            pdf.setFont(bold_font, 9.8)
            pdf.setFillColor(theme["accent"])
            pdf.drawString(margin, y, degree_lines[0])
            if date_label:
                pdf.setFont(bold_font, 7.8)
                pdf.setFillColor(theme["muted"])
                pdf.drawRightString(page_width - margin, y, date_label)
            y -= 4.5 * mm
            for line in degree_lines[1:]:
                pdf.setFont(bold_font, 9.8)
                pdf.setFillColor(theme["accent"])
                pdf.drawString(margin, y, line)
                y -= 4.5 * mm
            pdf.setFont(bold_font, 8.8)
            pdf.setFillColor(theme["text"])
            pdf.drawString(margin, y, item.institution)
            y -= 4.4 * mm
            if item.details.strip():
                draw_wrapped(item.details, size=8.8, color=theme["muted"], leading_mm=4.5)
            if education_index < len(payload.education) - 1:
                y -= theme["item_gap"] * mm

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
            value_lines = wrapped_lines(value, content_width - label_width, regular_font, theme["body_size"])
            ensure_space(len(value_lines) * theme["body_leading"])
            pdf.setFont(bold_font, 8.0)
            pdf.setFillColor(theme["muted"])
            pdf.drawString(margin, y, label.upper())
            pdf.setFont(regular_font, theme["body_size"])
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
            date_label = f"{_format_date(exp.start_date, payload.date_format)} - {_format_date(exp.end_date, payload.date_format)}"
            role_x = margin + (5 * mm if theme["style"] == "modern" else 0)
            role_width = content_width - 55 * mm
            role_lines = wrapped_lines(exp.role, role_width, bold_font, 10.8)
            first_bullet_lines = wrapped_lines(
                bullets[0] if bullets else "",
                content_width - (role_x - margin) - pdfmetrics.stringWidth("- ", regular_font, theme["body_size"]),
                regular_font,
                theme["body_size"],
            )
            minimum_item_height = (len(role_lines) + 1) * 4.5
            minimum_item_height += min(2, len(first_bullet_lines)) * theme["body_leading"]
            ensure_space(max(14, minimum_item_height))
            if theme["style"] == "modern":
                pdf.setFillColor(theme["highlight"])
                pdf.roundRect(margin, y - 1 * mm, 2.4 * mm, 2.4 * mm, .7 * mm, stroke=0, fill=1)
            pdf.setFont(bold_font, 10.8)
            pdf.setFillColor(theme["accent"])
            pdf.drawString(role_x, y, role_lines[0])
            pdf.setFont(bold_font if theme["style"] == "classic" else regular_font, 7.8)
            pdf.setFillColor(theme["muted"])
            pdf.drawRightString(page_width - margin, y, date_label)
            y -= 4.5 * mm
            for extra_role_line in role_lines[1:]:
                pdf.setFont(bold_font, 10.8)
                pdf.setFillColor(theme["accent"])
                pdf.drawString(role_x, y, extra_role_line)
                y -= 4.5 * mm
            pdf.setFont(bold_font, 9.1)
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
            name_width = content_width - 35 * mm
            name_lines = wrapped_lines(cert.name, name_width, bold_font, 9.7)
            detail = cert.issuer
            if cert.credential_id:
                detail = f"{detail}  |  Credential ID: {cert.credential_id}"
            detail_lines = wrapped_lines(detail, content_width, regular_font, 8.8)
            ensure_space((len(name_lines) * 4.4) + min(2, len(detail_lines)) * 4.5)
            pdf.setFont(bold_font, 9.7)
            pdf.setFillColor(theme["accent"])
            pdf.drawString(margin, y, name_lines[0])
            pdf.setFont(bold_font, 7.8)
            pdf.setFillColor(theme["muted"])
            pdf.drawRightString(page_width - margin, y, cert.year)
            y -= 4.4 * mm
            for extra_name_line in name_lines[1:]:
                pdf.setFont(bold_font, 9.7)
                pdf.setFillColor(theme["accent"])
                pdf.drawString(margin, y, extra_name_line)
                y -= 4.4 * mm
            draw_wrapped(detail, size=8.8, color=theme["muted"], leading_mm=4.5)
            if cert_index < len(payload.certifications) - 1:
                y -= 1.2 * mm

    draw_footer()
    pdf.save()
    pdf_bytes = buffer.getvalue()
    _verify_ats_extractability(pdf_bytes, payload)
    return pdf_bytes


def _register_unicode_fonts() -> dict[str, str]:
    global _FONT_NAMES
    if _FONT_NAMES is not None:
        return _FONT_NAMES

    regular_candidates = [
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
    ]
    bold_candidates = [
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    ]
    heading_candidates = [
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"),
        *bold_candidates,
    ]

    regular_path = next((path for path in regular_candidates if path.exists()), None)
    bold_path = next((path for path in bold_candidates if path.exists()), regular_path)
    heading_path = next((path for path in heading_candidates if path.exists()), bold_path)
    if regular_path is None or bold_path is None or heading_path is None:
        raise PDFGenerationError("Unicode fonts are unavailable on the PDF server.")

    pdfmetrics.registerFont(TTFont("CVSans", str(regular_path)))
    pdfmetrics.registerFont(TTFont("CVSans-Bold", str(bold_path)))
    pdfmetrics.registerFont(TTFont("CVHeading-Bold", str(heading_path)))
    _FONT_NAMES = {"regular": "CVSans", "bold": "CVSans-Bold", "heading": "CVHeading-Bold"}
    return _FONT_NAMES


def _verify_ats_extractability(pdf_bytes: bytes, payload: CVPayload) -> None:
    try:
        with pymupdf.open(stream=pdf_bytes, filetype="pdf") as document:
            extracted = "\n".join(page.get_text("text", sort=True) for page in document)
    except Exception as exc:
        raise PDFGenerationError("The generated PDF could not be verified.") from exc

    normalized = " ".join(extracted.split()).casefold()
    required_values = [payload.full_name.strip(), payload.title.strip(), payload.contact_profile.email.strip()]
    missing = [value for value in required_values if value and value.casefold() not in normalized]
    source_length = len(payload.full_name) + len(payload.title) + len(payload.summary)
    source_length += sum(len(exp.company) + len(exp.role) + len(exp.bullets) for exp in payload.experiences)
    source_length += sum(len(item.institution) + len(item.degree) + len(item.details) for item in payload.education)
    minimum_text = min(300, max(40, int(source_length * 0.35)))
    if missing or len(normalized) < minimum_text:
        raise PDFGenerationError("ATS verification failed because important CV text was not extractable.")


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


def _link_target(value: str) -> str:
    cleaned = value.strip()
    return cleaned if cleaned.startswith(("https://", "http://")) else f"https://{cleaned}"


def _format_date(value: str, date_format: str) -> str:
    cleaned = value.strip()
    if cleaned.lower() in {"present", "current", "now"}:
        return "Present"
    if not cleaned:
        return "-"
    parsed = None
    for pattern in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            parsed = datetime.strptime(cleaned, pattern)
            break
        except ValueError:
            continue
    if parsed is None:
        return cleaned
    if date_format == "MM/YYYY":
        return parsed.strftime("%m/%Y")
    if date_format == "YYYY-MM":
        return parsed.strftime("%Y-%m")
    if date_format == "DD MMM YYYY":
        return parsed.strftime("%d %b %Y")
    return parsed.strftime("%b %Y")

"""
Manifestation PDF Export Service

Generates a formatted PDF of the manifestation form using reportlab.
Layout matches the frontend UI with colored section headers, numbered items,
checkmarks for completed items, and arrow connectors between rows.
"""

from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_LEFT


# Section header colors matching the Tailwind UI
SECTION_COLORS = {
    "strong_life_changes": colors.HexColor("#334155"),   # slate-700
    "big_targets": colors.HexColor("#f97316"),            # orange-500
    "top_values": colors.HexColor("#1e293b"),             # slate-800
    "non_negotiables": colors.HexColor("#475569"),        # slate-600
    "life_rules": colors.HexColor("#6b7280"),             # gray-500
    "rituals": colors.HexColor("#4b5563"),                # gray-600
    "courage_list": colors.HexColor("#9333ea"),           # purple-600
}

ARROW_COLOR = colors.HexColor("#f59e0b")  # amber-500
LIGHT_BG = colors.HexColor("#fafafa")
BORDER_COLOR = colors.HexColor("#e5e7eb")
TEXT_COLOR = colors.HexColor("#374151")
MUTED_COLOR = colors.HexColor("#94a3b8")


def _escape_xml(text: str) -> str:
    """Escape XML special characters for reportlab Paragraph."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _build_section_table(
    title: str,
    items: list,
    header_color,
    max_items: int = 5,
):
    """Build a single section as a Table with colored header and numbered items."""

    header_style = ParagraphStyle(
        f"Header_{title}",
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=colors.white,
        alignment=TA_CENTER,
        leading=11,
        spaceBefore=0,
        spaceAfter=0,
    )

    item_style = ParagraphStyle(
        f"Item_{title}",
        fontName="Helvetica",
        fontSize=8,
        textColor=TEXT_COLOR,
        alignment=TA_LEFT,
        leading=10,
        spaceBefore=0,
        spaceAfter=0,
    )

    # Build rows: header + items
    data = [[Paragraph(title, header_style)]]

    for i in range(max_items):
        if i < len(items):
            item = items[i]

            # Handle dict items (big_targets, courage_list)
            if isinstance(item, dict):
                text = item.get("text", "")
                completed = item.get("completed", False)
                if text:
                    safe_text = _escape_xml(text)
                    if completed:
                        display = f'<b>{i + 1}.</b> <strike>{safe_text}</strike>  \u2713'
                    else:
                        display = f"<b>{i + 1}.</b> {safe_text}"
                else:
                    display = f"<b>{i + 1}.</b> ............"

            # Handle plain string items
            elif isinstance(item, str) and item.strip():
                display = f"<b>{i + 1}.</b> {_escape_xml(item)}"
            else:
                display = f"<b>{i + 1}.</b> ............"
        else:
            display = f"<b>{i + 1}.</b> ............"

        data.append([Paragraph(display, item_style)])

    table = Table(data, colWidths=["*"])
    table.setStyle(
        TableStyle(
            [
                # Header row styling
                ("BACKGROUND", (0, 0), (-1, 0), header_color),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, 0), 5),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
                # Item rows styling
                ("BACKGROUND", (0, 1), (-1, -1), LIGHT_BG),
                ("TOPPADDING", (0, 1), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
                ("LEFTPADDING", (0, 1), (-1, -1), 8),
                # Border
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("LINEBELOW", (0, 0), (-1, 0), 1, header_color),
            ]
        )
    )

    return table


def generate_manifestation_pdf(data: dict, category: str) -> BytesIO:
    """Generate a formatted PDF from manifestation data. Returns a BytesIO buffer."""
    buffer = BytesIO()

    page_size = landscape(A4)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        topMargin=0.35 * inch,
        bottomMargin=0.3 * inch,
        leftMargin=0.5 * inch,
        rightMargin=0.5 * inch,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Available content width
    avail_width = page_size[0] - doc.leftMargin - doc.rightMargin

    # ── Title: Year Theme ──
    title_style = ParagraphStyle(
        "ManifestationTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=16,
        textColor=colors.HexColor("#1e293b"),
        alignment=TA_CENTER,
        spaceAfter=1,
    )
    year = data.get("year", datetime.now().year) or datetime.now().year
    elements.append(Paragraph(f"{year} Theme", title_style))

    # ── Theme subtitle ──
    theme = data.get("theme", "") or "(No theme set)"
    theme_style = ParagraphStyle(
        "ThemeSubtitle",
        fontName="Helvetica-Oblique",
        fontSize=11,
        textColor=colors.HexColor("#64748b"),
        alignment=TA_CENTER,
        spaceAfter=2,
    )
    elements.append(Paragraph(_escape_xml(theme), theme_style))

    # ── Category badge ──
    cat_style = ParagraphStyle(
        "CategoryBadge",
        fontName="Helvetica-Bold",
        fontSize=7,
        textColor=MUTED_COLOR,
        alignment=TA_CENTER,
        spaceAfter=6,
    )
    elements.append(Paragraph(f"[ {category.upper()} ]", cat_style))

    # Common zero-padding style for all outer wrapper tables
    zero_pad = TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ])

    # Column width calculations — consistent gap sizes
    GAP = 10  # gap between columns (points)
    col2_width = (avail_width - GAP) / 2
    col4_width = (avail_width - 3 * GAP) / 4

    # ── ROW 1: Strong 5 Life Changes | Big 5 Targets (2 columns) ──
    strong_items = data.get("strong_life_changes", [])
    big_items = data.get("big_targets", [])

    strong_section = _build_section_table(
        "STRONG 5 LIFE CHANGES", strong_items, SECTION_COLORS["strong_life_changes"]
    )
    big_section = _build_section_table(
        "BIG 5", big_items, SECTION_COLORS["big_targets"]
    )

    row1 = Table(
        [[strong_section, "", big_section]],
        colWidths=[col2_width, GAP, col2_width],
    )
    row1.setStyle(zero_pad)
    elements.append(row1)

    # ── Up Arrows ──
    arrow_style = ParagraphStyle(
        "Arrow",
        fontName="Helvetica-Bold",
        fontSize=14,
        textColor=ARROW_COLOR,
        alignment=TA_CENTER,
        spaceBefore=1,
        spaceAfter=1,
    )
    arrow_up = Table(
        [[Paragraph("\u2191", arrow_style), "", Paragraph("\u2191", arrow_style)]],
        colWidths=[col2_width, GAP, col2_width],
    )
    arrow_up.setStyle(zero_pad)
    elements.append(arrow_up)

    # ── ROW 2: Top 5 Values (full width) ──
    values_items = data.get("top_values", [])
    values_section = _build_section_table(
        "TOP 5 VALUES", values_items, SECTION_COLORS["top_values"]
    )

    row2 = Table([[values_section]], colWidths=[avail_width])
    row2.setStyle(zero_pad)
    elements.append(row2)

    # ── Down Arrows ──
    arrow_down = Table(
        [[
            Paragraph("\u2193", arrow_style), "",
            Paragraph("\u2193", arrow_style), "",
            Paragraph("\u2193", arrow_style), "",
            Paragraph("\u2193", arrow_style),
        ]],
        colWidths=[col4_width, GAP, col4_width, GAP, col4_width, GAP, col4_width],
    )
    arrow_down.setStyle(zero_pad)
    elements.append(arrow_down)

    # ── ROW 3: Non-Negotiables | Life Rules | Rituals | Courage List (4 columns) ──
    non_neg_items = data.get("non_negotiables", [])
    rules_items = data.get("life_rules", [])
    rituals_items = data.get("rituals", [])
    courage_items = data.get("courage_list", [])

    non_neg_section = _build_section_table(
        "MAIN 5 NON-NEGOTIABLES", non_neg_items, SECTION_COLORS["non_negotiables"]
    )
    rules_section = _build_section_table(
        "KEY 5 LIFE RULES", rules_items, SECTION_COLORS["life_rules"]
    )
    rituals_section = _build_section_table(
        "BEST 5 RITUALS", rituals_items, SECTION_COLORS["rituals"]
    )
    courage_section = _build_section_table(
        "COURAGE LIST", courage_items, SECTION_COLORS["courage_list"]
    )

    row3 = Table(
        [[non_neg_section, "", rules_section, "", rituals_section, "", courage_section]],
        colWidths=[col4_width, GAP, col4_width, GAP, col4_width, GAP, col4_width],
    )
    row3.setStyle(zero_pad)
    elements.append(row3)

    # ── Footer ──
    elements.append(Spacer(1, 6))
    footer_style = ParagraphStyle(
        "Footer",
        fontName="Helvetica",
        fontSize=6,
        textColor=MUTED_COLOR,
        alignment=TA_CENTER,
    )
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    elements.append(Paragraph(f"Generated on {now}", footer_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer

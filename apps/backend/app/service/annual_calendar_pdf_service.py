"""
Annual Calendar PDF Export Service

Generates a complete 12-month landscape A4 PDF calendar using reportlab canvas.
Plans are rendered as colored bars spanning their date ranges.

The layout dynamically scales all dimensions so the calendar ALWAYS fits on a
single page, regardless of how many overlapping events exist per month.
"""

from io import BytesIO
from calendar import monthrange
from datetime import date, datetime

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors


MONTH_NAMES = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
]

WEEKDAY_NAMES = ["Su", "M", "Tu", "W", "Th", "F", "Sa"]

MAX_CELL = 34  # 5 weeks × 7 days − 1; 6-week months clip last day(s)

# Plan color name → (fill_rgb, text_rgb)
PLAN_COLORS: dict[str, tuple[tuple, tuple]] = {
    "red":    ((0.94, 0.27, 0.27), (1.0, 1.0, 1.0)),
    "yellow": ((0.98, 0.75, 0.15), (0.0, 0.0, 0.0)),
    "orange": ((0.98, 0.49, 0.13), (1.0, 1.0, 1.0)),
    "blue":   ((0.23, 0.51, 0.96), (1.0, 1.0, 1.0)),
    "green":  ((0.13, 0.77, 0.37), (1.0, 1.0, 1.0)),
    "black":  ((0.05, 0.05, 0.05), (1.0, 1.0, 1.0)),
    "white":  ((1.0,  1.0,  1.0 ), (0.1, 0.1, 0.1)),
    "purple": ((0.66, 0.16, 0.94), (1.0, 1.0, 1.0)),
    "pink":   ((0.93, 0.28, 0.60), (1.0, 1.0, 1.0)),
}


def _first_weekday_sun(year: int, month: int) -> int:
    """Return the 0-based Sunday-first weekday index of the 1st of the month."""
    wd = date(year, month, 1).weekday()  # Mon=0, Sun=6
    return (wd + 1) % 7                  # Sun=0, Sat=6


def _plan_rows_for_month(
    year: int, month: int, plans: list[dict]
) -> tuple[list[tuple], int]:
    """
    Assign each overlapping plan to a row (greedy first-fit, no row cap).
    Returns (spans, max_rows) where each span is (plan_dict, start_cell, end_cell, row).
    Cell indices are 0-based within the 35-column grid (clamped to MAX_CELL).
    """
    fw = _first_weekday_sun(year, month)
    days_in_month = monthrange(year, month)[1]
    month_start = date(year, month, 1)
    month_end = date(year, month, days_in_month)

    overlapping: list[tuple[dict, int, int]] = []
    for plan in plans:
        p_start = date.fromisoformat(plan["start_date"])
        p_end = date.fromisoformat(plan["end_date"])
        if p_start <= month_end and p_end >= month_start:
            c_start = max(p_start, month_start)
            c_end = min(p_end, month_end)
            start_cell = min(fw + c_start.day - 1, MAX_CELL)
            end_cell = min(fw + c_end.day - 1, MAX_CELL)
            if start_cell > MAX_CELL:
                continue
            overlapping.append((plan, start_cell, end_cell))

    overlapping.sort(key=lambda x: x[1])

    row_occupancy: dict[int, set] = {}
    spans: list[tuple] = []
    for plan, start_cell, end_cell in overlapping:
        row = 0
        while True:
            occupied = row_occupancy.setdefault(row, set())
            cells = set(range(start_cell, end_cell + 1))
            if not cells & occupied:
                occupied |= cells
                break
            row += 1
        spans.append((plan, start_cell, end_cell, row))

    max_rows = max((s[3] for s in spans), default=-1) + 1
    return spans, max_rows


def _truncate_text(c: canvas.Canvas, text: str, font: str, size: float, max_w: float) -> str:
    """Truncate text with ellipsis to fit within max_w points."""
    if c.stringWidth(text, font, size) <= max_w:
        return text
    while len(text) > 1:
        text = text[:-1]
        if c.stringWidth(text + "…", font, size) <= max_w:
            return text + "…"
    return ""


def generate_annual_calendar_pdf(plans: list[dict], year: int) -> BytesIO:
    """
    Generate a landscape A4 PDF showing the full year calendar with coloured plan bars.
    Dynamically scales dimensions so ALL events fit on exactly one page.
    Returns a seeked BytesIO buffer ready for streaming.
    """
    buffer = BytesIO()
    PAGE_W, PAGE_H = landscape(A4)  # 841.9 × 595.3 pts

    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))

    # ── Fixed margins ────────────────────────────────────────────────────────
    L = 28    # left margin
    R = 28    # right margin
    B = 18    # bottom margin (footer lives here)
    MONTH_COL = 52  # month-name column width

    content_w = PAGE_W - L - R          # 786 pts
    grid_w = content_w - MONTH_COL      # 734 pts
    CELL_W = grid_w / 35               # ≈ 20.97 pts per cell

    x0 = L + MONTH_COL  # x-start of day-cell grid

    # ── Base (unscaled) layout constants ────────────────────────────────────
    B_TITLE_H   = 22   # year title
    B_TITLE_GAP = 8    # gap below title
    B_HDR_H     = 12   # weekday header row
    B_HDR_GAP   = 5    # gap below header (includes separator line space)
    B_DATE_H    = 11   # date-number row height per month
    B_BAR_H     = 7    # plan bar height
    B_BAR_GAP   = 1    # gap between stacked plan bars
    B_SEP       = 6    # total space consumed by month separator (line + gap)

    # ── Compute actual plan rows needed per month (no cap) ───────────────────
    today = datetime.now().date()
    month_rows: list[int] = []
    month_spans: list[list[tuple]] = []
    for mi in range(12):
        spans, rows = _plan_rows_for_month(year, mi + 1, plans)
        month_rows.append(rows)
        month_spans.append(spans)

    # ── First pass: calculate total height with base dimensions ──────────────
    total_h_base = B_TITLE_H + B_TITLE_GAP + B_HDR_H + B_HDR_GAP
    for mi, rows in enumerate(month_rows):
        total_h_base += B_DATE_H + rows * (B_BAR_H + B_BAR_GAP)
        if mi < 11:
            total_h_base += B_SEP

    # ── Scale to fit available height ────────────────────────────────────────
    available_h = PAGE_H - B  # usable height above footer (≈ 577 pts)
    scale = min(1.0, available_h / total_h_base)

    TITLE_H   = B_TITLE_H   * scale
    TITLE_GAP = B_TITLE_GAP * scale
    HDR_H     = B_HDR_H     * scale
    HDR_GAP   = B_HDR_GAP   * scale
    DATE_H    = B_DATE_H    * scale
    BAR_H     = B_BAR_H     * scale
    BAR_GAP   = B_BAR_GAP   * scale
    SEP       = B_SEP       * scale

    # Scaled font sizes (minimum 3 pt so text doesn't disappear entirely)
    FS_TITLE  = max(3.0, 20  * scale)
    FS_MONTH  = max(3.0, 7.5 * scale)
    FS_DATE   = max(3.0, 7   * scale)
    FS_HDR    = max(3.0, 6.5 * scale)
    FS_BAR    = max(3.0, 5.5 * scale)

    # ── Actual total height after scaling ─────────────────────────────────────
    total_h = total_h_base * scale  # = min(total_h_base, available_h)

    # ── Centre vertically within usable area ────────────────────────────────
    # content spans from y_top down to (y_top - total_h)
    # centre of content = y_top - total_h/2 = (PAGE_H + B) / 2 → centred above footer
    y = B + (available_h + total_h) / 2

    # ── Year title ────────────────────────────────────────────────────────────
    title_y = y - TITLE_H + TITLE_H * 0.35
    c.setFont("Helvetica-Bold", FS_TITLE)
    c.setFillColor(colors.HexColor("#1e40af"))
    c.drawCentredString(PAGE_W / 2, title_y, str(year))

    box_w = max(60, 90 * scale)
    box_h = TITLE_H
    c.setStrokeColor(colors.HexColor("#1e40af"))
    c.setLineWidth(max(0.5, 1.5 * scale))
    c.rect(PAGE_W / 2 - box_w / 2, title_y - TITLE_H * 0.25, box_w, box_h, fill=0, stroke=1)

    y -= TITLE_H + TITLE_GAP

    # ── Weekday headers ───────────────────────────────────────────────────────
    c.setFont("Helvetica-Bold", FS_HDR)
    for week in range(5):
        for di, dname in enumerate(WEEKDAY_NAMES):
            col = week * 7 + di
            cx = x0 + col * CELL_W + CELL_W / 2
            c.setFillColor(
                colors.HexColor("#dc2626") if di in (0, 6) else colors.HexColor("#374151")
            )
            c.drawCentredString(cx, y - HDR_H * 0.65, dname)

    y -= HDR_H
    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.setLineWidth(0.5)
    c.line(L, y - 1, L + content_w, y - 1)
    y -= HDR_GAP - 1  # 1 already consumed by separator position

    # ── Month rows ────────────────────────────────────────────────────────────
    for month_idx in range(12):
        month = month_idx + 1
        fw = _first_weekday_sun(year, month)
        days_in_month = monthrange(year, month)[1]
        rows = month_rows[month_idx]
        spans = month_spans[month_idx]

        month_h = DATE_H + rows * (BAR_H + BAR_GAP)
        row_top = y

        # Month name
        c.setFont("Helvetica-Bold", FS_MONTH)
        c.setFillColor(colors.HexColor("#1e40af"))
        c.drawString(L, row_top - DATE_H * 0.7, MONTH_NAMES[month_idx])

        # Date numbers
        for day in range(1, days_in_month + 1):
            col = fw + day - 1
            if col > MAX_CELL:
                continue
            cx = x0 + col * CELL_W + CELL_W / 2

            d_date = date(year, month, day)
            wd_sun = (d_date.weekday() + 1) % 7  # Sun=0, Sat=6
            is_weekend = wd_sun in (0, 6)
            is_today = d_date == today

            if is_today:
                c.setFillColor(colors.HexColor("#dbeafe"))
                c.setStrokeColor(colors.HexColor("#3b82f6"))
                c.setLineWidth(max(0.3, 0.8 * scale))
                c.rect(
                    x0 + col * CELL_W + 0.5, row_top - DATE_H,
                    CELL_W - 1, DATE_H - 0.5,
                    fill=1, stroke=1,
                )
                c.setFont("Helvetica-Bold", FS_DATE)
                c.setFillColor(colors.HexColor("#1d4ed8"))
            else:
                c.setFont("Helvetica", FS_DATE)
                c.setFillColor(
                    colors.HexColor("#dc2626") if is_weekend else colors.HexColor("#111827")
                )
            c.drawCentredString(cx, row_top - DATE_H * 0.7, str(day))

        # Vertical week separator lines
        c.setStrokeColor(colors.HexColor("#e5e7eb"))
        c.setLineWidth(0.3)
        for sep_w in range(1, 5):
            sx = x0 + sep_w * 7 * CELL_W
            c.line(sx, row_top, sx, row_top - month_h)

        # Plan bars
        for plan_dict, start_cell, end_cell, row in spans:
            fill_rgb, text_rgb = PLAN_COLORS.get(
                plan_dict.get("color", "blue"), PLAN_COLORS["blue"]
            )
            bar_x = x0 + start_cell * CELL_W + 0.5
            bar_y = row_top - DATE_H - row * (BAR_H + BAR_GAP) - BAR_H
            bar_w = (end_cell - start_cell + 1) * CELL_W - 1

            c.setFillColorRGB(*fill_rgb)
            is_white = plan_dict.get("color") == "white"
            if is_white:
                c.setStrokeColor(colors.HexColor("#9ca3af"))
                c.setLineWidth(0.4)
                c.roundRect(bar_x, bar_y, bar_w, BAR_H, max(0.5, 1 * scale), fill=1, stroke=1)
            else:
                c.setLineWidth(0)
                c.roundRect(bar_x, bar_y, bar_w, BAR_H, max(0.5, 1 * scale), fill=1, stroke=0)

            title = plan_dict.get("title", "")
            if title and bar_w > 4 and BAR_H > 3:
                c.setFillColorRGB(*text_rgb)
                c.setFont("Helvetica-Bold", FS_BAR)
                truncated = _truncate_text(c, title, "Helvetica-Bold", FS_BAR, bar_w - 3)
                if truncated:
                    c.drawCentredString(bar_x + bar_w / 2, bar_y + BAR_H * 0.2, truncated)

        y -= month_h

        # Month separator (except after December)
        if month_idx < 11:
            sep_y = y - SEP * 0.4
            c.setStrokeColor(colors.HexColor("#9ca3af"))
            c.setLineWidth(max(0.3, 0.6 * scale))
            c.line(L, sep_y, L + content_w, sep_y)
            y -= SEP

    # ── Footer ────────────────────────────────────────────────────────────────
    c.setFont("Helvetica", 5.5)
    c.setFillColor(colors.HexColor("#9ca3af"))
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    c.drawCentredString(
        PAGE_W / 2, B - 6,
        f"CEO Dashboard · Annual Calendar {year} · Generated {now_str}",
    )

    c.save()
    buffer.seek(0)
    return buffer

"""Render the checked-in write-up to one A4 page and a PNG for visual review.

Optional delivery-only dependencies: reportlab, pypdf, pypdfium2.
Run from the repository root: python scripts/render-writeup.py
"""
from pathlib import Path
from html import escape
import re

import pypdfium2 as pdfium
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

root = Path(__file__).resolve().parent.parent
source = root / "docs" / "WRITEUP.md"
output = root / "docs" / "WRITEUP.pdf"
preview = root / "tmp" / "writeup-page.png"
preview.parent.mkdir(exist_ok=True)
styles = {
    "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=colors.HexColor("#164e3d"), spaceAfter=14),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=10, leading=15, textColor=colors.HexColor("#1f2937")),
}
story = []
for block in source.read_text(encoding="utf-8").strip().split("\n\n"):
    title = block.startswith("# ")
    text = escape(block.removeprefix("# ").replace("\n", " "))
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    story.append(Paragraph(text, styles["title" if title else "body"]))
    if not title:
        story.append(Spacer(1, 12))
doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=48, leftMargin=48, topMargin=46, bottomMargin=46, title="BookLeaf Portal - Approach and Trade-offs", author="BookLeaf assignment")
doc.build(story)
reader = PdfReader(output)
if len(reader.pages) != 1:
    raise SystemExit(f"Write-up must remain one page; rendered {len(reader.pages)} pages.")
pdf = pdfium.PdfDocument(str(output))
page = pdf[0]
bitmap = page.render(scale=1.5)
bitmap.to_pil().save(preview)
bitmap.close()
page.close()
pdf.close()
print(f"PASS: one-page A4 write-up: {output}")
print(f"Visual preview: {preview}")

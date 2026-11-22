"""Generate an original DOCX fixture with the same structural categories as a course module.
No user-uploaded document content is committed to the repository.
"""
from pathlib import Path
from docx import Document

out = Path("test-results/apa7-module-fixture.docx")
out.parent.mkdir(parents=True, exist_ok=True)
doc = Document()
doc.add_heading("MÓDULO DE PRUEBA APA 7", level=1)
doc.add_paragraph("Fundamentos de sistemas de información")
doc.add_heading("Introducción", level=2)
doc.add_paragraph("Esta prueba comprueba la importación de párrafos, tablas y referencias.")
doc.add_paragraph("La literatura presenta distintas perspectivas (Ejemplo, 2024).")
doc.add_heading("Tabla 1", level=2)
table = doc.add_table(rows=1, cols=2)
table.rows[0].cells[0].text = "Tendencia"
table.rows[0].cells[1].text = "Pregunta preliminar"
for left, right in [("Analítica de datos", "¿Cómo mejorar la calidad?"), ("Computación en la nube", "¿Qué riesgos existen?")]:
    cells = table.add_row().cells
    cells[0].text = left
    cells[1].text = right
doc.add_heading("Referencias", level=2)
doc.add_paragraph("Ejemplo, A. (2024). Título ficticio de referencia. Editorial de prueba.")
doc.save(out)
print(out)

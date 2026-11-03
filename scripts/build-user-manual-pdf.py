"""Build printable PDFs from Markdown under docs/."""

from __future__ import annotations

import html
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import markdown
except ImportError:
    sys.stderr.write("Instala markdown: python -m pip install markdown\n")
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

JOBS = (
    {
        "source": DOCS / "manual-usuario.md",
        "pdf": DOCS / "manual-usuario.pdf",
        "title": "Manual de uso — Hotel Demo",
    },
    {
        "source": DOCS / "cuentas-de-acceso.md",
        "pdf": DOCS / "cuentas-de-acceso.pdf",
        "title": "Cuentas de acceso — Hotel Demo",
    },
)

_local_accounts = DOCS / "cuentas-de-acceso.local.md"
if _local_accounts.exists():
    JOBS = JOBS + (
        {
            "source": _local_accounts,
            "pdf": DOCS / "cuentas-de-acceso.local.pdf",
            "title": "Cuentas de acceso (local) — Hotel Demo",
        },
    )

CSS = """
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
html { font-size: 11pt; }
body {
  font-family: "Segoe UI", Calibri, Arial, sans-serif;
  color: #18181b;
  line-height: 1.45;
  max-width: 100%;
}
h1 { font-size: 1.7rem; color: #115e59; margin-top: 0; }
h2 { font-size: 1.25rem; color: #134e4a; border-bottom: 1px solid #ccfbf1; padding-bottom: 0.2rem; page-break-after: avoid; }
h3 { font-size: 1.05rem; color: #3f3f46; page-break-after: avoid; }
p, li { orphans: 3; widows: 3; }
table { border-collapse: collapse; width: 100%; font-size: 0.88rem; margin: 0.8rem 0 1.2rem; page-break-inside: avoid; }
th, td { border: 1px solid #d4d4d8; padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
th { background: #f0fdfa; }
code { font-family: Consolas, "Courier New", monospace; font-size: 0.9em; background: #f4f4f5; padding: 0.05rem 0.25rem; }
pre { background: #f4f4f5; padding: 0.7rem 0.8rem; overflow-wrap: anywhere; white-space: pre-wrap; }
a { color: #0f766e; }
"""


def find_chrome() -> Path | None:
    names = ["msedge.exe", "chrome.exe"]
    roots = [
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    ]
    for path in roots:
        if path.exists():
            return path
    for name in names:
        found = shutil.which(name)
        if found:
            return Path(found)
    return None


def build(source: Path, pdf: Path, title: str, chrome: Path) -> None:
    text = source.read_text(encoding="utf-8")
    body = markdown.markdown(
        text,
        extensions=["tables", "fenced_code", "nl2br"],
    )
    page = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{html.escape(title)}</title>
  <style>{CSS}</style>
</head>
<body>
{body}
</body>
</html>
"""
    html_path = source.with_name(f".{source.stem}.html")
    html_path.write_text(page, encoding="utf-8")
    cmd = [
        str(chrome),
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf}",
        html_path.resolve().as_uri(),
    ]
    result = subprocess.run(cmd, check=False)
    html_path.unlink(missing_ok=True)
    if result.returncode != 0 or not pdf.exists():
        sys.stderr.write(f"Falló {pdf.name} (código {result.returncode}).\n")
        raise SystemExit(1)
    print(f"PDF escrito: {pdf} ({pdf.stat().st_size} bytes)")


def main() -> None:
    wanted = set(sys.argv[1:])
    jobs = JOBS
    if wanted:
        jobs = tuple(job for job in JOBS if job["pdf"].stem in wanted or job["source"].stem in wanted)
        if not jobs:
            sys.stderr.write("Uso: python scripts/build-user-manual-pdf.py [manual-usuario|cuentas-de-acceso]\n")
            raise SystemExit(1)

    chrome = find_chrome()
    if chrome is None:
        sys.stderr.write("No se encontró Microsoft Edge ni Google Chrome para imprimir el PDF.\n")
        raise SystemExit(1)

    for job in jobs:
        build(job["source"], job["pdf"], job["title"], chrome)


if __name__ == "__main__":
    main()

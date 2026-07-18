from pathlib import Path

root = Path(r"C:\Users\Stood\telephantix-demo\public")
css = (root / "styles.css").read_text(encoding="utf-8")
html = (root / "index.html").read_text(encoding="utf-8")

# Avoid double-inlining if run twice
if "/* emergency always-visible Luna button" in html:
    # strip previous injection between markers
    start = html.find("<style>\n:root")
    if start == -1:
        start = html.find("<style>")
    # simpler: re-read from git? just rebuild from styles + base structure
    pass

inline = f"<style>\n{css}\n</style>\n"
extra = """
<style>
/* emergency always-visible Luna button (even if other CSS fails) */
#luna-camp-fixed{
  position:fixed!important;z-index:99999!important;left:12px!important;top:72px!important;
  display:inline-flex!important;align-items:center!important;gap:10px!important;
  padding:14px 18px!important;border-radius:14px!important;
  background:#1a4a7a!important;color:#fff!important;font:700 16px/1.2 system-ui,sans-serif!important;
  border:2px solid #7ec8ff!important;text-decoration:none!important;
  box-shadow:0 8px 28px rgba(0,0,0,.55)!important;
}
#luna-camp-fixed:hover{background:#2563a8!important}
</style>
"""

# If already inlined, remove old link-only and rebuild from clean marker
if 'id="luna-camp-fixed"' in html:
    print("Already has fixed button; rewriting from styles.css + current body...")

# Replace stylesheet link with full inline CSS
if 'href="styles.css"' in html:
    html = html.replace(
        '<link rel="stylesheet" href="styles.css" />',
        inline + extra + '<link rel="stylesheet" href="styles.css" />',
        1,
    )
else:
    # insert before </head>
    html = html.replace("</head>", inline + extra + "</head>", 1)

btn = (
    '\n  <a id="luna-camp-fixed" href="https://telephanti.com/firmament/play" '
    'target="_blank" rel="noopener noreferrer">🏕️ Open Luna Camp →</a>\n'
)

if 'id="luna-camp-fixed"' not in html:
    html = html.replace(
        '<body class="has-bio site-home">',
        '<body class="has-bio site-home">' + btn,
        1,
    )

(root / "index.html").write_text(html, encoding="utf-8")
print("OK", len(html), "bytes")
print("inline", "<style>" in html)
print("fixed btn", "luna-camp-fixed" in html)

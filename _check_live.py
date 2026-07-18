import urllib.request
import ssl

ctx = ssl.create_default_context()
for u in (
    "https://telephantim-hub.onrender.com/?nocache=3",
    "https://telephantim.com/?nocache=3",
):
    try:
        req = urllib.request.Request(
            u, headers={"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"}
        )
        h = urllib.request.urlopen(req, timeout=40, context=ctx).read().decode(
            "utf-8", "ignore"
        )
        print(u)
        print("  len", len(h))
        print("  Scroll down", "Scroll down" in h)
        print("  btn-luna", "btn-luna" in h)
        print("  stage section", 'class="stage"' in h)
        print("  content main", 'class="content"' in h)
    except Exception as e:
        print(u, "ERR", e)

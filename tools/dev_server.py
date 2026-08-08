#!/usr/bin/env python3
"""
Local dev server with a save-to-disk endpoint for the in-browser live editor.

Unlike `python -m http.server`, this can actually write your edits back into
index.html — that's the whole point of it. It only serves the "Save" button
in js/edit-mode.js; the plain content-server behavior is identical to
`python -m http.server` otherwise.

Usage:
    python tools/dev_server.py            # serves on http://localhost:8080/
    python tools/dev_server.py 5000       # custom port

Safety:
    - Binds to 127.0.0.1 only — never reachable from your network, let alone
      the internet.
    - Only the exact `data-edit="..."` markers listed below can be written;
      anything else is rejected. Nothing outside index.html is ever touched.
    - A save either fully succeeds (every requested marker found and
      replaced) or fully fails and writes nothing — never a half-applied file.
"""

import functools
import http.server
import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INDEX_HTML = PROJECT_ROOT / "index.html"

# marker -> expected tag name. Must match the data-edit attributes in index.html.
EDITABLE_MARKERS = {
    "hero-eyebrow": "p",
    "hero-name": "h1",
    "hero-tagline": "p",
    "hero-lead": "p",
    "hero-status": "span",
    "about-p1": "p",
    "about-p2": "p",
    "research-intro": "p",
    "theme-a-title": "h3",
    "theme-a-text": "p",
    "theme-b-title": "h3",
    "theme-b-text": "p",
    "theme-c-title": "h3",
    "theme-c-text": "p",
    "contact-title": "h2",
    "contact-sub": "p",
}


def apply_edits(html, edits):
    """Replace the inner content of each whitelisted data-edit element.
    Returns (new_html, errors). Applies nothing if there are any errors."""
    errors = []
    working = html

    for edit in edits:
        marker = edit.get("marker")
        new_inner = edit.get("html", "")
        expected_tag = EDITABLE_MARKERS.get(marker)

        if expected_tag is None:
            errors.append(f'"{marker}" is not an editable marker')
            continue
        if edit.get("tag") != expected_tag:
            errors.append(f'"{marker}" tag mismatch (expected <{expected_tag}>)')
            continue

        pattern = re.compile(
            r"(<" + expected_tag + r"\b[^>]*\bdata-edit=\"" + re.escape(marker) + r"\"[^>]*>)"
            r"(.*?)"
            r"(</" + expected_tag + r">)",
            re.DOTALL,
        )
        working, count = pattern.subn(
            lambda m: m.group(1) + new_inner + m.group(3), working, count=1
        )
        if count == 0:
            errors.append(f'"{marker}" not found in index.html (structure may have changed)')

    if errors:
        return html, errors
    return working, []


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/__save__":
            self.send_error(404, "Unknown endpoint")
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            edits = body.get("edits", [])
        except (ValueError, json.JSONDecodeError):
            self._json_response(400, {"error": "Malformed request body"})
            return

        original = INDEX_HTML.read_text(encoding="utf-8")
        updated, errors = apply_edits(original, edits)

        if errors:
            self._json_response(400, {"error": "; ".join(errors)})
            return

        INDEX_HTML.write_text(updated, encoding="utf-8")
        print(f"Saved {len(edits)} edit(s) to index.html")
        self._json_response(200, {"ok": True, "count": len(edits)})

    def _json_response(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Quieter default logging; keep POSTs visible via the print() above.
        if self.command != "POST":
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = functools.partial(Handler, directory=str(PROJECT_ROOT))
    with http.server.HTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Serving {PROJECT_ROOT} at http://localhost:{port}/  (Ctrl+C to stop)")
        print("Live editing enabled — see the 'Local Editor' panel bottom-right in the browser.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()

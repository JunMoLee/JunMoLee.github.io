#!/usr/bin/env python3
"""
Local dev server for the in-browser live editor (js/edit-mode.js).

Unlike `python -m http.server`, this can write your edits back into
index.html and publish them to GitHub — that's the whole point of it. The
plain content-serving behavior is otherwise identical to
`python -m http.server`.

Usage:
    python tools/dev_server.py            # serves on http://localhost:8090/
    python tools/dev_server.py 5000       # custom port

Endpoints (used by js/edit-mode.js, not meant to be called directly):
    POST /__save__      Write text edits into index.html.
    POST /__publish__    git add -A && git commit && git push, in this repo.

Safety:
    - Binds to 127.0.0.1 only — never reachable from your network, let alone
      the internet.
    - /__save__ only writes the exact `data-edit="..."` markers listed below;
      anything else is rejected, and a save either fully succeeds (every
      requested marker found and replaced) or fully fails and writes
      nothing — never a half-applied file.
    - /__publish__ runs plain git commands in this project's working tree —
      the same thing you'd type yourself. It pushes to whatever remote your
      local git is already configured with (`git remote -v`), using your
      existing credentials. There is no separate auth step; anyone who can
      reach this server (i.e., you, on your own machine) can publish.
"""

import functools
import http.server
import json
import re
import subprocess
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


def run_git(*args):
    """Run a git command in the project root. Returns (returncode, stdout, stderr)."""
    result = subprocess.run(
        ["git", *args],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/__save__":
            self._handle_save()
        elif self.path == "/__publish__":
            self._handle_publish()
        else:
            self.send_error(404, "Unknown endpoint")

    def _handle_save(self):
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

    def _handle_publish(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}") if length else {}
        except (ValueError, json.JSONDecodeError):
            body = {}

        message = (body.get("message") or "").strip() or "Update site content"
        log = []

        code, out, err = run_git("add", "-A")
        log.append(f"$ git add -A\n{out}{err}".strip())
        if code != 0:
            self._json_response(500, {"error": "git add failed", "log": "\n\n".join(log)})
            return

        code, out, err = run_git("diff", "--cached", "--quiet")
        if code == 0:
            # Nothing staged — nothing changed since the last commit.
            self._json_response(200, {"ok": True, "nothing_to_publish": True, "log": "No changes to publish."})
            return

        code, out, err = run_git("commit", "-m", message)
        log.append(f"$ git commit -m \"{message}\"\n{out}{err}".strip())
        if code != 0:
            self._json_response(500, {"error": "git commit failed", "log": "\n\n".join(log)})
            return

        code, out, err = run_git("push")
        log.append(f"$ git push\n{out}{err}".strip())
        if code != 0:
            self._json_response(500, {"error": "git push failed (commit succeeded locally)", "log": "\n\n".join(log)})
            return

        print(f'Published: "{message}"')
        self._json_response(200, {"ok": True, "log": "\n\n".join(log)})

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


class ExclusiveHTTPServer(http.server.HTTPServer):
    # HTTPServer defaults allow_reuse_address=True, which on Windows lets a
    # second process silently bind the same port instead of erroring — so
    # double-launching the editor would start two overlapping servers with
    # no warning. Disabling it makes a duplicate launch fail loudly instead,
    # which main() below turns into a friendly message.
    allow_reuse_address = False


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
    handler = functools.partial(Handler, directory=str(PROJECT_ROOT))
    try:
        httpd = ExclusiveHTTPServer(("127.0.0.1", port), handler)
    except OSError as e:
        if e.errno in (48, 98, 10048):  # macOS, Linux, Windows "address in use"
            print(f"Port {port} is already in use — the server is probably already running.")
            print(f"Just open http://localhost:{port}/?edit=1 in your browser.")
            return
        if e.errno == 10013:  # Windows WSAEACCES — another program has claimed this port
            print(f"Port {port} is blocked by another program on this machine (not this project).")
            print(f"Try a different port: python tools/dev_server.py {port + 1}")
            print("(and update the port in \"Edit Website.bat\" to match if you want the shortcut to use it)")
            return
        raise

    with httpd:
        print(f"Serving {PROJECT_ROOT} at http://localhost:{port}/  (Ctrl+C to stop)")
        print("Live editing enabled — see the 'Local Editor' panel bottom-right in the browser.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()

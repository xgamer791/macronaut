#!/usr/bin/env python3
"""Post-process Expo static export for GitHub Pages.

Two jobs.

**Cache busting.** GitHub Pages serves HTML with Cache-Control: max-age=600.
Meta no-cache tags do not override that, so phones can keep an old entry-*.js
for up to 10 minutes after a deploy. This script:

1. Writes dist/version.json with the git SHA
2. Appends ?v=<sha> to bundled script/link URLs in HTML
3. Injects a small head script that compares localStorage / version.json
   (fetched with cache: 'no-store') and, on mismatch, navigates to
   ?_build=<sha> — a fresh URL that bypasses the cached HTML.

**Deep links into dynamic routes.** Expo writes a dynamic route out under its
literal name — `u/[handle].html`, `meal/[id].html` — so a real URL like
`/u/chris` matches no file and Pages, which has no rewrites, serves its 404.
Copying index.html to 404.html fixes that: every route ships the same
entry-*.js, and expo-router picks the route from window.location on boot, so
the fallback hydrates the page the link actually asked for.
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys

MARKER_START = "<!-- macronaut-cachebust:start -->"
MARKER_END = "<!-- macronaut-cachebust:end -->"


def resolve_build_id() -> str:
    env = os.environ.get("GITHUB_SHA")
    if env:
        return env.strip()
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except Exception as exc:  # pragma: no cover
        print(f"unable to resolve build id: {exc}", file=sys.stderr)
        sys.exit(1)


def bust_asset_urls(text: str, build: str) -> str:
    def repl(match: re.Match[str]) -> str:
        attr, url = match.group(1), match.group(2)
        if url.startswith("data:"):
            return match.group(0)
        sep = "&" if "?" in url else "?"
        # Drop a previous bust query then append the current build.
        url = re.sub(r"([?&])v=[^&\"']*", r"\1", url).rstrip("?&")
        sep = "&" if "?" in url else "?"
        return f'{attr}="{url}{sep}v={build}"'

    return re.sub(r'(src|href)="([^"]+)"', repl, text)


def build_inject(build: str, base: str) -> str:
    script = f"""<script>(function(){{
var KEY='macronaut-build';
var BUILD={json.dumps(build)};
var prev=localStorage.getItem(KEY);
localStorage.setItem(KEY, BUILD);
if(prev && prev!==BUILD){{
  var u=new URL(location.href);
  u.searchParams.set('_build', BUILD);
  location.replace(u.toString());
  return;
}}
function check(){{
  fetch({json.dumps(base + "/version.json")} + '?_=' + Date.now(), {{cache:'no-store'}})
    .then(function(r){{return r.json();}})
    .then(function(v){{
      if(v && v.build && v.build!==BUILD){{
        localStorage.setItem(KEY, v.build);
        var u=new URL(location.href);
        u.searchParams.set('_build', v.build);
        location.replace(u.toString());
      }}
    }}).catch(function(){{}});
}}
check();
// A tab left open keeps its old bundle for as long as it stays open, and an
// old bundle talking to a freshly deployed backend is the worst kind of
// broken: it half works. Re-check whenever the tab comes back to the front.
document.addEventListener('visibilitychange', function(){{
  if(document.visibilityState==='visible') check();
}});
}})();</script>"""
    return (
        MARKER_START
        + '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />'
        + '<meta http-equiv="Pragma" content="no-cache" />'
        + '<meta http-equiv="Expires" content="0" />'
        + script
        + MARKER_END
    )


def main() -> None:
    dist = pathlib.Path("dist")
    if not dist.is_dir():
        print("dist/ missing — run export first", file=sys.stderr)
        sys.exit(1)

    build = resolve_build_id()
    base = "/macronaut"
    (dist / "version.json").write_text(json.dumps({"build": build}) + "\n", encoding="utf-8")
    inject = build_inject(build, base)

    # Written before the patch loop so the fallback gets the same treatment as
    # every other page. index.html is the shell to copy: its asset URLs are
    # absolute under the base path, so they still resolve when Pages serves
    # this file for a deeper URL like /u/chris.
    index = dist / "index.html"
    if not index.is_file():
        print("dist/index.html missing — export did not produce a shell", file=sys.stderr)
        sys.exit(1)
    (dist / "404.html").write_text(index.read_text(encoding="utf-8"), encoding="utf-8")
    print("wrote dist/404.html (SPA fallback for dynamic routes)")

    patched = 0
    for path in dist.rglob("*.html"):
        text = path.read_text(encoding="utf-8")
        # Replace a previous inject block if present.
        text = re.sub(
            re.escape(MARKER_START) + r".*?" + re.escape(MARKER_END),
            "",
            text,
            flags=re.S,
        )
        # Legacy inject without markers (first cachebust version).
        text = re.sub(
            r'<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />'
            r'<meta http-equiv="Pragma" content="no-cache" />'
            r'<meta http-equiv="Expires" content="0" />'
            r"<script>\(function\(\)\{var KEY='macronaut-build';.*?</script>",
            "",
            text,
            flags=re.S,
        )
        text, n = re.subn(r"<head>", "<head>" + inject, text, count=1, flags=re.I)
        text = bust_asset_urls(text, build)
        path.write_text(text, encoding="utf-8")
        patched += 1
        print(f"patched {path} head_inject={n}")

    print(f"version={build} patched_html={patched}")


if __name__ == "__main__":
    main()

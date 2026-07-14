#!/usr/bin/env python3
"""Post-process Expo static export so GitHub Pages clients see new deploys ASAP.

GitHub Pages serves HTML with Cache-Control: max-age=600. Meta no-cache tags
do not override that, so phones can keep an old entry-*.js for up to 10 minutes
after a deploy. This script:

1. Writes dist/version.json with the git SHA
2. Appends ?v=<sha> to bundled script/link URLs in HTML
3. Injects a small head script that compares localStorage / version.json
   (fetched with cache: 'no-store') and, on mismatch, navigates to
   ?_build=<sha> — a fresh URL that bypasses the cached HTML.
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

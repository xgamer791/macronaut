#!/usr/bin/env python3
"""Post-process Expo static export so GitHub Pages clients see new deploys ASAP.

GitHub Pages serves HTML with Cache-Control: max-age=600. Meta no-cache tags
do not override that, so phones can keep an old entry-*.js for up to 10 minutes
after a deploy. This script:

1. Writes dist/version.json with the git SHA
2. Injects a small head script that compares localStorage to version.json
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


def resolve_build_id() -> str:
    env = os.environ.get("GITHUB_SHA")
    if env:
        return env.strip()
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        )
    except Exception as exc:  # pragma: no cover
        print(f"unable to resolve build id: {exc}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    dist = pathlib.Path("dist")
    if not dist.is_dir():
        print("dist/ missing — run export first", file=sys.stderr)
        sys.exit(1)

    build = resolve_build_id()
    base = "/macronaut"
    version_path = dist / "version.json"
    version_path.write_text(json.dumps({"build": build}) + "\n", encoding="utf-8")

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

    inject = (
        '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />'
        '<meta http-equiv="Pragma" content="no-cache" />'
        '<meta http-equiv="Expires" content="0" />'
        + script
    )

    patched = 0
    for path in dist.rglob("*.html"):
        text = path.read_text(encoding="utf-8")
        if "macronaut-build" in text:
            continue
        text2, n = re.subn(r"<head>", "<head>" + inject, text, count=1, flags=re.I)
        if n:
            path.write_text(text2, encoding="utf-8")
            patched += 1
            print(f"patched {path}")

    print(f"version={build} patched_html={patched}")


if __name__ == "__main__":
    main()

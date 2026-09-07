#!/usr/bin/env python3
"""Post-process Expo static export for GitHub Pages.

Two jobs.

**Cache busting.** GitHub Pages serves every file with Cache-Control: max-age=600,
including version.json. Meta no-cache tags do not override that, and a fetch
of version.json with cache:'no-store' still hits the Fastly copy for up to
ten minutes — so a stale tab never learns a new deploy shipped.

This script:

1. Writes dist/version.json with the git SHA
2. Appends ?v=<sha> to bundled script/link URLs in HTML
3. Injects a head script that asks Convex /web-build (Cache-Control: no-store,
   not on the Pages CDN). On mismatch it navigates to ?_build=<sha>&_t=<now>
   — a unique URL, so Fastly cannot reuse a poisoned cache entry. It keeps
   checking for two minutes and whenever the tab is shown again.

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


def resolve_convex_site() -> str | None:
    for key in ("CONVEX_CLOUD_URL", "EXPO_PUBLIC_CONVEX_URL"):
        val = os.environ.get(key, "").strip()
        if val:
            return val.replace(".convex.cloud", ".convex.site").rstrip("/")
    js = pathlib.Path("dist/_expo/static/js/web")
    if js.is_dir():
        for path in js.rglob("*"):
            if not path.is_file():
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            match = re.search(r"https://[a-z0-9-]+\.convex\.cloud", text)
            if match:
                return match.group(0).replace(".convex.cloud", ".convex.site")
    return None


def bust_asset_urls(text: str, build: str) -> str:
    def repl(match: re.Match[str]) -> str:
        attr, url = match.group(1), match.group(2)
        if url.startswith("data:"):
            return match.group(0)
        # Drop a previous bust query then append the current build.
        url = re.sub(r"([?&])v=[^&\"']*", r"\1", url).rstrip("?&")
        sep = "&" if "?" in url else "?"
        return f'{attr}="{url}{sep}v={build}"'

    return re.sub(r'(src|href)="([^"]+)"', repl, text)


def build_inject(build: str, base: str, convex_site: str | None) -> str:
    probes = []
    if convex_site:
        probes.append(convex_site + "/web-build")
    probes.append(base + "/version.json")
    script = f"""<script>(function(){{
var KEY='macronaut-build';
var BUILD={json.dumps(build)};
var PROBES={json.dumps(probes)};
var reloading=false;
function reload(sha){{
  if(reloading) return;
  var last=sessionStorage.getItem('macronaut-bust');
  if(last && Date.now()-Number(last)<8000) return;
  reloading=true;
  sessionStorage.setItem('macronaut-bust', String(Date.now()));
  var u=new URL(location.href);
  u.searchParams.set('_build', sha);
  u.searchParams.set('_t', String(Date.now()));
  location.replace(u.toString());
}}
function consider(sha){{
  if(!sha || sha===BUILD){{
    localStorage.setItem(KEY, BUILD);
    return;
  }}
  reload(sha);
}}
function check(){{
  var i=0;
  function next(){{
    if(i>=PROBES.length) return;
    var url=PROBES[i++]+(PROBES[i-1].indexOf('?')>=0?'&':'?')+'_='+Date.now();
    fetch(url,{{cache:'no-store'}})
      .then(function(r){{return r.ok?r.json():Promise.reject();}})
      .then(function(v){{if(v&&v.build) consider(v.build); else next();}})
      .catch(next);
  }}
  next();
}}
check();
document.addEventListener('visibilitychange', function(){{
  if(document.visibilityState==='visible') check();
}});
window.addEventListener('pageshow', function(e){{
  if(e.persisted) check();
}});
window.addEventListener('focus', check);
var n=0;
var iv=setInterval(function(){{
  check();
  if(++n>=15) clearInterval(iv);
}}, 8000);
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
    convex_site = resolve_convex_site()
    (dist / "version.json").write_text(json.dumps({"build": build}) + "\n", encoding="utf-8")
    inject = build_inject(build, base, convex_site)

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
    if convex_site:
        print(f"convex_probe={convex_site}/web-build")
    else:
        print("convex_probe=missing — falling back to version.json only", file=sys.stderr)

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

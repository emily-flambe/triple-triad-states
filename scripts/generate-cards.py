#!/usr/bin/env python3
"""Generate card art for all 50 US states using Imagen 4 Ultra.

Usage:
    python3 scripts/generate-cards.py              # generate missing images only
    python3 scripts/generate-cards.py --all        # regenerate all images
    python3 scripts/generate-cards.py --limit 10   # generate at most 10 missing images
"""

import json
import base64
import time
import os
import sys
import glob
from urllib.request import Request, urlopen
from urllib.error import HTTPError

API_KEY = "AIzaSyBbRMXd47b8f1BxGf6zgDKFJl0oiBL27gY"
MODEL = "gemini-3-pro-image-preview"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(SCRIPT_DIR, "..")
PROMPTS_DIR = os.path.join(ROOT_DIR, "prompts")
OUT_DIR = os.path.join(ROOT_DIR, "public", "images", "cards")


def get_prompt_files():
    """Find all prompt files and return sorted list of (id, slug, prompt_path)."""
    files = sorted(glob.glob(os.path.join(PROMPTS_DIR, "*.txt")))
    results = []
    for f in files:
        basename = os.path.splitext(os.path.basename(f))[0]
        parts = basename.split("-", 1)
        state_id = int(parts[0])
        slug = parts[1]
        results.append((state_id, slug, f))
    return results


def generate_image(state_id, slug, prompt_path):
    with open(prompt_path) as f:
        prompt = f.read().strip()

    filename = f"{str(state_id).zfill(2)}-{slug}.png"
    outpath = os.path.join(OUT_DIR, filename)

    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
            "imageConfig": {"aspectRatio": "1:1"}
        }
    }).encode()

    req = Request(URL, data=body, headers={"Content-Type": "application/json"})

    max_retries = 3
    for attempt in range(max_retries):
        try:
            resp = urlopen(req, timeout=120)
            data = json.loads(resp.read())
            for candidate in data.get("candidates", []):
                for part in candidate.get("content", {}).get("parts", []):
                    if "inlineData" in part:
                        img_data = base64.b64decode(part["inlineData"]["data"])
                        with open(outpath, "wb") as f:
                            f.write(img_data)
                        size_kb = len(img_data) // 1024
                        print(f"  OK  {filename} ({size_kb}KB)")
                        return True
        except HTTPError as e:
            error_body = e.read().decode()
            if e.code == 429 or "RESOURCE_EXHAUSTED" in error_body:
                wait = 30 * (attempt + 1)
                print(f"  RATE LIMITED on {filename}, waiting {wait}s (attempt {attempt+1}/{max_retries})")
                time.sleep(wait)
            else:
                print(f"  FAIL {filename}: HTTP {e.code} - {error_body[:200]}")
                return False
        except Exception as e:
            print(f"  FAIL {filename}: {e}")
            return False

    print(f"  GAVE UP on {filename} after {max_retries} retries")
    return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    regen_all = "--all" in sys.argv
    limit = None
    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        limit = int(sys.argv[idx + 1])

    states = get_prompt_files()
    total = len(states)
    generated = 0
    skipped = 0
    failed = []

    for i, (state_id, slug, prompt_path) in enumerate(states):
        filename = f"{str(state_id).zfill(2)}-{slug}.png"
        outpath = os.path.join(OUT_DIR, filename)

        if not regen_all and os.path.exists(outpath):
            print(f"[{i+1}/{total}] SKIP {filename} (exists)")
            skipped += 1
            continue

        if limit is not None and generated >= limit:
            print(f"[{i+1}/{total}] STOP (reached --limit {limit})")
            break

        print(f"[{i+1}/{total}] Generating {filename}...")
        if generate_image(state_id, slug, prompt_path):
            generated += 1
        else:
            failed.append(filename)

        # Delay between requests to avoid rate limits
        time.sleep(2)

    print(f"\nDone: {generated} generated, {skipped} skipped")
    if failed:
        print(f"Failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()

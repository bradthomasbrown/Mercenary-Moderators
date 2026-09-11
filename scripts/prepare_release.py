"""Prepare versioned release assets from the recorded, reproducible source."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--tag", required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
release = json.loads((root / "release.json").read_text())
version = release["version"]
if not re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,3}", version) or args.tag != "v" + version:
    raise SystemExit("The tag must match the version recorded in release.json.")
filename = "mm-user-" + version + ".zip"
if release["filename"] != filename:
    raise SystemExit("Unexpected installer filename.")
if not (root / "docs" / "releases" / (version + ".md")).is_file():
    raise SystemExit("Versioned release notes are required.")
subprocess.run([sys.executable, str(root / "scripts" / "build.py"), "--verify"], check=True)
archive = (root / "dist" / filename).read_bytes()
digest = hashlib.sha256(archive).hexdigest()
if digest != release["sha256"]:
    raise SystemExit("Installer checksum mismatch.")
(root / "dist" / "SHA256SUMS.txt").write_text(digest + "  " + filename + "\n")
if os.environ.get("GITHUB_ENV"):
    with open(os.environ["GITHUB_ENV"], "a") as output:
        output.write("RELEASE_VERSION=" + version + "\nRELEASE_ZIP=" + filename + "\n")
print(json.dumps({"tag": args.tag, "installer": filename, "sha256": digest, "checksum": "SHA256SUMS.txt"}))

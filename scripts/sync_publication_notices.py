"""Add license documents and current notes without replacing released assets."""
import base64
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
repository = os.environ["GITHUB_REPOSITORY"]
if repository != "bradthomasbrown/Mercenary-Moderators":
    raise SystemExit("Publication maintenance is limited to the official repository.")

def run(*args):
    return subprocess.check_output(args, text=True, cwd=root)

def api(path, body=None):
    command = ["gh", "api", path]
    if body is not None:
        command += ["--method", "PUT", "--input", "-"]
    result = subprocess.run(command, input=json.dumps(body) if body is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)

release = json.loads((root / "release.json").read_text())
tag = "v" + release["version"]
run(sys.executable, "scripts/prepare_release.py", "--tag", tag)
legal = json.loads(run(sys.executable, "scripts/build_notices.py"))
view = json.loads(run("gh", "release", "view", tag, "--repo", repository,
                      "--json", "url,tagName,isDraft,isPrerelease,assets"))
if view["tagName"] != tag or view["isDraft"] is not False:
    raise SystemExit("A published release with the expected tag is required.")
assets = {asset["name"]: asset for asset in view["assets"]}
with tempfile.TemporaryDirectory(prefix="mm-publication-") as work:
    work = Path(work)
    # Verify the old immutable assets before editing notes or adding anything.
    for name in (release["filename"], "SHA256SUMS.txt"):
        if name not in assets:
            raise SystemExit("Missing existing release asset: " + name)
        run("gh", "release", "download", tag, "--repo", repository,
            "--pattern", name, "--dir", str(work))
        if (work / name).read_bytes() != (root / "dist" / name).read_bytes():
            raise SystemExit("Existing release asset mismatch: " + name)
    name = legal["filename"]
    if name not in assets:
        run("gh", "release", "upload", tag, str(root / "dist" / name), "--repo", repository)
    run("gh", "release", "download", tag, "--repo", repository,
        "--pattern", name, "--dir", str(work))
    if (work / name).read_bytes() != (root / "dist" / name).read_bytes():
        raise SystemExit("Legal-notices asset mismatch; refusing to replace it.")

notes = root / "docs" / "releases" / (release["version"] + ".md")
run("gh", "release", "edit", tag, "--repo", repository, "--notes-file", str(notes))
published_notes = json.loads(run("gh", "release", "view", tag, "--repo", repository, "--json", "body"))["body"]
if published_notes.replace("\r\n", "\n").strip() != notes.read_text().strip():
    raise SystemExit("Published release notes do not match.")
metadata = api("repos/" + repository)
record = {
    "recordedAt": datetime.now(timezone.utc).isoformat(),
    "status": "license-notices-and-release-notes-verified",
    "repositoryPrivate": metadata["private"],
    "tag": tag,
    "sourceCommit": run("git", "rev-parse", "HEAD").strip(),
    "installerUnchanged": True,
    "installerSha256": release["sha256"],
    "legalAsset": legal,
    "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(),
    "releaseNotesVerified": True,
    "releaseUrl": view["url"],
    "workflowUrl": "https://github.com/" + repository + "/actions/runs/" + os.environ["GITHUB_RUN_ID"],
}
path = "repos/" + repository + "/contents/release-history/licensing.json"
existing = subprocess.run(["gh", "api", path + "?ref=main"], text=True, capture_output=True)
body = {"message": "Record verified license publication notices", "branch": "main",
        "content": base64.b64encode((json.dumps(record, indent=2) + "\n").encode()).decode()}
if existing.returncode == 0:
    body["sha"] = json.loads(existing.stdout)["sha"]
elif "HTTP 404" not in existing.stderr:
    raise SystemExit("Could not check existing publication record.")
api(path, body)
print(json.dumps(record))

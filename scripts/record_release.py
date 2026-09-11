"""Record a workflow result on main so Git-only maintainers can verify releases."""
import base64
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
repository = os.environ["GITHUB_REPOSITORY"]
tag = os.environ["RELEASE_TAG"]
if not re.fullmatch(r"v[0-9]+(?:\.[0-9]+){1,3}", tag):
    raise SystemExit("Invalid release tag.")

def api(path, body=None):
    command = ["gh", "api", path]
    if body is not None:
        command += ["--method", "PUT", "--input", "-"]
    result = subprocess.run(command, input=json.dumps(body) if body is not None else None,
                            text=True, capture_output=True)
    if result.returncode:
        if body is None and "HTTP 404" in result.stderr:
            return None
        raise RuntimeError("GitHub API request failed: " + result.stderr[:300])
    return json.loads(result.stdout)

if repository != "bradthomasbrown/Mercenary-Moderators":
    raise SystemExit("Release recording is limited to the official repository.")
repository_private = api("repos/" + repository)["private"]
release = json.loads((root / "release.json").read_text())
response_path = root / ".release-response.json"
response = json.loads(response_path.read_text()) if response_path.exists() else None
success = os.environ["RELEASE_JOB_STATUS"] == "success" and response is not None and response["isDraft"] is False
record = {
    "recordedAt": datetime.now(timezone.utc).isoformat(),
    "status": ("published-private-prerelease" if repository_private else "published-public-prerelease") if success else "workflow-failed-check-actions",
    "tag": tag, "sourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
    "repositoryPrivate": repository_private, "installer": release["filename"], "sha256": release["sha256"],
    "uploadedAssetsDownloadedAndCompared": success,
    "workflowUrl": "https://github.com/" + repository + "/actions/runs/" + os.environ["GITHUB_RUN_ID"],
    "release": response,
}
path = "repos/" + repository + "/contents/release-history/" + tag + ".json"
existing = api(path + "?ref=main")
if existing:
    previous = json.loads(base64.b64decode(existing["content"]))
    if previous.get("status") in ("published-private-prerelease", "published-public-prerelease"):
        print("Retaining the existing verified release record.")
        raise SystemExit(0)
body = {"message": "Record " + tag + " release result", "branch": "main",
        "content": base64.b64encode((json.dumps(record, indent=2) + "\n").encode()).decode()}
if existing:
    body["sha"] = existing["sha"]
api(path, body)
print(json.dumps({"tag": tag, "status": record["status"], "record": "release-history/" + tag + ".json"}))

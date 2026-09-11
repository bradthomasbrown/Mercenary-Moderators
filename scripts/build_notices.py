"""Build a deterministic, content-addressed archive of distribution notices."""
import hashlib
import io
import json
import os
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
files = ("LICENSE", "NOTICE", "CONTRIBUTING.md", "THIRD-PARTY-NOTICES.md", "LICENSES/LGPL-2.0-or-later.txt")
buffer = io.BytesIO()
with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
    for name in files:
        info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        archive.writestr(info, (root / name).read_bytes())
body = buffer.getvalue()
digest = hashlib.sha256(body).hexdigest()
filename = "mm-legal-notices-" + digest[:16] + ".zip"
output = root / "dist" / filename
output.parent.mkdir(exist_ok=True)
output.write_bytes(body)
if os.environ.get("GITHUB_ENV"):
    with open(os.environ["GITHUB_ENV"], "a") as env:
        env.write("LEGAL_ZIP=" + filename + "\n")
print(json.dumps({"filename": filename, "sha256": digest, "files": list(files)}))

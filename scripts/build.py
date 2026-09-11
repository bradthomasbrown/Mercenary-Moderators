"""Reproduce the user ZIP from its plain source files; no network or dependencies."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--verify", action="store_true", help="Require exact release file and archive digests.")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
release = json.loads((root / "release.json").read_text())
local, central, offset = [], [], 0

for entry in release["files"]:
    name = entry["path"]
    if Path(name).name != name or name in (".", ".."):
        raise SystemExit("Only flat extension asset names are allowed.")
    body = (root / "extension" / name).read_bytes()
    if args.verify and (len(body) != entry["byteLength"] or hashlib.sha256(body).hexdigest() != entry["sha256"]):
        raise SystemExit("Source differs from the recorded release: " + name)
    encoded = name.encode("utf-8")
    crc = zlib.crc32(body)
    # Original archive: stored entries, UTF-8 names, fixed DOS date/time,
    # Unix mode 0644. Preserve the source manifest's sorted entry order.
    header = struct.pack("<IHHHHHIIIHH", 0x04034B50, 20, 0x0800, 0, 0, 0x0021,
                         crc, len(body), len(body), len(encoded), 0) + encoded
    local.extend((header, body))
    central.append(struct.pack("<IHHHHHHIIIHHHHHII", 0x02014B50, 0x0314, 20,
                               0x0800, 0, 0, 0x0021, crc, len(body), len(body),
                               len(encoded), 0, 0, 0, 0, 0x81A40000, offset) + encoded)
    offset += len(header) + len(body)

directory = b"".join(central)
count = len(release["files"])
archive = b"".join(local) + directory + struct.pack("<IHHHHIIH", 0x06054B50, 0, 0, count, count, len(directory), offset, 0)
digest = hashlib.sha256(archive).hexdigest()
if args.verify and (digest != release["sha256"] or len(archive) != release["byteLength"]):
    raise SystemExit("Built ZIP differs from the recorded release.")
filename = release["filename"]
if Path(filename).name != filename:
    raise SystemExit("Invalid output filename.")
output = root / "dist" / filename
output.parent.mkdir(exist_ok=True)
output.write_bytes(archive)
print(json.dumps({"file": str(output.relative_to(root)), "sha256": digest,
                  "matchesRecordedRelease": digest == release["sha256"], "sourceFiles": count}))

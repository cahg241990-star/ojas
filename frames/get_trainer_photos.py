# OJAS - download the real-trainer photos (free public-domain library) into frames/real/
# so the app shows them even without internet.
# HOW TO RUN (PYTHON window):
#   cd "C:\Users\Happy\Desktop\Ojas\app\ojas-app\frames"
#   python get_trainer_photos.py
# Writes a report file: trainer_photos_report.txt  (Claude reads it to check the result).
# Source: github.com/yuhonas/free-exercise-db  (Unlicense / public domain)
import os, re, sys, time, datetime, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(HERE, "real")
BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"

def read_ids():
    """Read the exercise -> photo ID list straight from data-media.js, so it always matches the app."""
    path = os.path.join(APP, "data-media.js")
    with open(path, encoding="utf-8") as f:
        txt = f.read()
    block = txt.split("const FX = {", 1)[1].split("};", 1)[0]
    pairs = re.findall(r"'([a-z0-9-]+)'\s*:\s*'([A-Za-z0-9_\-]+)'", block)
    return pairs

def main():
    os.makedirs(OUT, exist_ok=True)
    pairs = read_ids()
    ids = sorted(set(p[1] for p in pairs))
    ok, skipped, failed = [], [], []
    print(f"Ojas: {len(pairs)} exercises use {len(ids)} trainer photo sets ({len(ids)*2} pictures).")
    for n, pid in enumerate(ids, 1):
        for i in (0, 1):
            name = f"{pid}_{i}.jpg"
            dest = os.path.join(OUT, name)
            if os.path.exists(dest) and os.path.getsize(dest) > 2000:
                skipped.append(name); continue
            url = f"{BASE}{pid}/{i}.jpg"
            for attempt in (1, 2, 3):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": "Ojas/1.1"})
                    with urllib.request.urlopen(req, timeout=30) as r:
                        data = r.read()
                    if len(data) < 2000 or not data[:3] == b"\xff\xd8\xff":
                        raise ValueError(f"not a JPG ({len(data)} bytes)")
                    with open(dest, "wb") as f:
                        f.write(data)
                    ok.append(name); break
                except Exception as e:
                    if attempt == 3:
                        failed.append(f"{name}: {e}")
                    else:
                        time.sleep(2)
        print(f"  [{n}/{len(ids)}] {pid}")
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith(".jpg"))
    lines = [
        "OJAS trainer photos report",
        f"Time: {datetime.datetime.now():%Y-%m-%d %H:%M}",
        f"Folder: {OUT}",
        f"Downloaded now: {len(ok)}",
        f"Already there (skipped): {len(skipped)}",
        f"Failed: {len(failed)}",
        f"Pictures in folder: {len([f for f in os.listdir(OUT) if f.endswith('.jpg')])}  ({total/1024/1024:.1f} MB)",
        "",
        "Exercise -> photo:",
    ] + [f"  {ex} -> {pid}" for ex, pid in pairs] + ([""] + ["FAILED:"] + ["  " + x for x in failed] if failed else [])
    result = f"RESULT: {len(ok)+len(skipped)} of {len(ids)*2} pictures ready, {len(failed)} failed"
    lines.insert(1, result)
    with open(os.path.join(HERE, "trainer_photos_report.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("\n" + result)
    print("Report saved: trainer_photos_report.txt")
    print("NEXT: upload the whole 'frames' folder to GitHub with the other app files.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e); sys.exit(1)

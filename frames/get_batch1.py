# OJAS - download batch 1 exercise pictures into this folder.
# HOW TO RUN (PYTHON window):  cd "C:\\Users\\Happy\\Desktop\\Ojas\\app\\ojas-app\\frames"   then   python get_batch1.py
# Plan B if the links have expired (they last about 1 hour after Claude made them):
#   open Canva design "Ojas exercise frames batch 1" -> Share -> Download -> JPG -> All pages -> save the ZIP
#   into this same frames folder, then run this script again. It finds the ZIP and renames the pictures.
# Writes a report file: batch1_download_report.txt (Claude reads it to check the result).
import json, os, sys, glob, zipfile, urllib.request, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
ITEMS = [
 {
  "file": "squat_1.png",
  "exercise": "bw-squat",
  "coach": "Riya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0002-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T200536Z&X-Amz-Expires=6656&X-Amz-Signature=8be8adeb68659600e4f3fb359d997913ab769b51ca1b7f225f03e4f78f6bb9c1&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2021%3A56%3A32%20GMT"
 },
 {
  "file": "squat_2.png",
  "exercise": "bw-squat",
  "coach": "Riya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0003-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T061805Z&X-Amz-Expires=57517&X-Amz-Signature=b457b796564e30ac8041f2d7131f13f15f8a7345483518ea1b2a0cd595e0a977&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2022%3A16%3A42%20GMT"
 },
 {
  "file": "lunge_1.png",
  "exercise": "split-squat",
  "coach": "Riya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0004-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261009%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261009T223430Z&X-Amz-Expires=84865&X-Amz-Signature=4941264b1afc572f79b5387ba1858c2d8bc720073937906951480de3f4aa88e4&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2022%3A08%3A55%20GMT"
 },
 {
  "file": "lunge_2.png",
  "exercise": "split-squat",
  "coach": "Riya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0005-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T050510Z&X-Amz-Expires=61668&X-Amz-Signature=b86af0256b72fdd2dca93d1e9fe8b2de59926eaaea7215f932fe242485519567&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2022%3A12%3A58%20GMT"
 },
 {
  "file": "pushup_1.png",
  "exercise": "pushup",
  "coach": "Vikram",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0006-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T061905Z&X-Amz-Expires=57192&X-Amz-Signature=b590b943937221272d501478c28f74b0c3609e2f5e74a7c6c2ba65afbc8e3b39&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2022%3A12%3A17%20GMT"
 },
 {
  "file": "pushup_2.png",
  "exercise": "pushup",
  "coach": "Vikram",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0007-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261009%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261009T213548Z&X-Amz-Expires=87222&X-Amz-Signature=464ba1b2623c48006dc88dbc4640afe00ae7bf18cc0106fa1b172179361fae3d&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2021%3A49%3A30%20GMT"
 },
 {
  "file": "plank_1.png",
  "exercise": "plank",
  "coach": "Vikram",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0008-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T194909Z&X-Amz-Expires=9062&X-Amz-Signature=c0710b93841e1465c0a05df7650753ae6fd6e359b31d003ddb7713ab79c9e294&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2022%3A20%3A11%20GMT"
 },
 {
  "file": "plank_2.png",
  "exercise": "plank",
  "coach": "Vikram",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0009-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T172136Z&X-Amz-Expires=14763&X-Amz-Signature=6699a09a6948f421bd2577697309e92b85d39eafcc5407fbd4a8c976a2c23e93&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2021%3A27%3A39%20GMT"
 },
 {
  "file": "row_1.png",
  "exercise": "db-row",
  "coach": "Kabir",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0010-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261009%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261009T230053Z&X-Amz-Expires=80769&X-Amz-Signature=43147ae84822199a6efec3ef1abdfce4c5ee42f96ade5f38e74a8a3c094d7b98&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2021%3A27%3A02%20GMT"
 },
 {
  "file": "row_2.png",
  "exercise": "db-row",
  "coach": "Kabir",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0011-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T110604Z&X-Amz-Expires=40070&X-Amz-Signature=3e0b5f67f996777ed7eb9dfc4d42c924023f3190547873d204a738f6e520b303&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2022%3A13%3A54%20GMT"
 },
 {
  "file": "press_1.png",
  "exercise": "shoulder-press",
  "coach": "Kabir",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0012-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261009%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261009T212153Z&X-Amz-Expires=89442&X-Amz-Signature=32b3ca40ceef909a23a84af581df6be1e2f4bb84f8bb89c8c6a3a252f9c1a09b&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2022%3A12%3A35%20GMT"
 },
 {
  "file": "press_2.png",
  "exercise": "shoulder-press",
  "coach": "Kabir",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0013-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T052913Z&X-Amz-Expires=60655&X-Amz-Signature=0340a5451da85052928ba8ea72752fe1060075e098c0a75db67201cefaa1727b&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2022%3A20%3A08%20GMT"
 },
 {
  "file": "bridge_1.png",
  "exercise": "glute-bridge",
  "coach": "Anaya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0014-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T004823Z&X-Amz-Expires=76816&X-Amz-Signature=927b02ff27e70a9d711bbcaf2f553b30b82a9e0e83166edba7380ce6a8be594d&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2022%3A08%3A39%20GMT"
 },
 {
  "file": "bridge_2.png",
  "exercise": "glute-bridge",
  "coach": "Anaya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0015-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T075721Z&X-Amz-Expires=50824&X-Amz-Signature=7d941a0ff889840c9c2719f98498d8b88b3039cb7b3109c5fb6370a00d62f3c9&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2022%3A04%3A25%20GMT"
 },
 {
  "file": "catcow_1.png",
  "exercise": "marjaryasana",
  "coach": "Anaya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0016-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T012949Z&X-Amz-Expires=71846&X-Amz-Signature=580ff9951aeaac21073855c1b5347451565b725a8574ab78f889e7d3f56315bf&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2021%3A27%3A15%20GMT"
 },
 {
  "file": "catcow_2.png",
  "exercise": "marjaryasana",
  "coach": "Anaya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0017-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T004241Z&X-Amz-Expires=76421&X-Amz-Signature=73f821dfdf7c2ed26cea2617b97bbceeebfe8f1168186c71a48f76cc5fcc6abb&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2021%3A56%3A22%20GMT"
 },
 {
  "file": "surya_1.png",
  "exercise": "surya-namaskar",
  "coach": "Anaya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0018-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T063604Z&X-Amz-Expires=53685&X-Amz-Signature=6c2de40c972cec636097ac7ff76632452f16e6b786168b029bdecd6eb5bfed07&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2021%3A30%3A49%20GMT"
 },
 {
  "file": "surya_2.png",
  "exercise": "surya-namaskar",
  "coach": "Anaya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0019-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T030413Z&X-Amz-Expires=67975&X-Amz-Signature=1706f63f6cefb4a674126e514cc3e91801d05b65aef1c9b732df93c7d8026d8a&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2021%3A57%3A08%20GMT"
 },
 {
  "file": "kegel_1.png",
  "exercise": "kegel",
  "coach": "Anaya",
  "url": "https://export-download.canva.com/30Vo4/DAHXpE30Vo4/-1/0/0020-6254892558631651325.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20261010%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261010T143345Z&X-Amz-Expires=25872&X-Amz-Signature=dd108a1ef35f2744d032b2113200727e044e4d339c589f6aec2733a75a6ed7ec&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Sat%2C%2010%20Oct%202026%2021%3A44%3A57%20GMT"
 }
]
report = []
def log(s):
    print(s); report.append(s)
log("Ojas batch 1 download - " + datetime.datetime.now().strftime("%Y-%m-%d %H:%M"))
ok = 0; failed = []
zips = sorted(glob.glob(os.path.join(HERE, "*.zip")), key=os.path.getmtime)
if zips:
    z = zips[-1]; log("Found ZIP from Canva: " + os.path.basename(z) + " - using it instead of links")
    with zipfile.ZipFile(z) as zf:
        names = sorted([n for n in zf.namelist() if n.lower().endswith((".jpg", ".jpeg", ".png"))])
        log("Pictures inside ZIP: %d" % len(names))
        # Canva numbers pages 1..20; page 1 is the empty cover, our frames are pages 2..20
        if len(names) == 20: names = names[1:]
        if len(names) != len(ITEMS):
            log("WARNING: expected %d pictures, ZIP has %d - check you exported ALL pages" % (len(ITEMS), len(names)))
        for it, n in zip(ITEMS, names):
            with open(os.path.join(HERE, it["file"].replace(".png", ".jpg")), "wb") as f: f.write(zf.read(n))
            ok += 1; log("  saved " + it["file"].replace(".png", ".jpg") + "  (" + it["coach"] + ")")
else:
    for it in ITEMS:
        out = os.path.join(HERE, it["file"].replace(".png", ".jpg"))
        try:
            with urllib.request.urlopen(it["url"], timeout=60) as r: data = r.read()
            if len(data) < 10000: raise ValueError("file too small (%d bytes)" % len(data))
            with open(out, "wb") as f: f.write(data)
            ok += 1; log("  OK   %-14s %7.0f KB  (%s)" % (os.path.basename(out), len(data)/1024, it["coach"]))
        except Exception as e:
            failed.append(it["file"]); log("  FAIL %-14s %s" % (os.path.basename(out), e))
log("RESULT: %d of %d pictures saved, %d failed" % (ok, len(ITEMS), len(failed)))
if failed:
    log("Links probably expired. Use Plan B at the top of this file (Canva -> Download -> JPG -> All pages -> ZIP here).")
with open(os.path.join(HERE, "batch1_download_report.txt"), "w", encoding="utf-8") as f: f.write("\n".join(report) + "\n")
print("Report written: batch1_download_report.txt")

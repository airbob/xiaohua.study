"""Step 1: count Chinese words per grade across the sgexamhub CL papers.

Reads OCR text from PrimarySchoolExamPapers/data/ocr (gitignored there, so this
script only runs on a machine that has the corpus) and writes
data/raw/word-stats.json: for every dictionary word, how many papers in each
grade contain it, plus a few clean example sentences.
"""
import json, re, sys, collections, os
from pathlib import Path
import jieba

OCR = Path(os.environ.get("OCR_DIR", Path.home() / "Documents/dreamon/code/PrimarySchoolExamPapers/data/ocr"))
OUT = Path(__file__).resolve().parent.parent / "data/raw/word-stats.json"
PAPER = re.compile(r"^([2-6])_\d+_([25])_\d_(\d{4})\.txt$")
CJK = re.compile(r"[一-鿿]+")
SENT_SPLIT = re.compile(r"[。！？!?；;]|\n\s*\n")
CLEAN_SENT = re.compile(r"^[一-鿿，、：“”‘’《》（）]+$")

jieba.setLogLevel(60)
dict_words = set()
for line in open(Path(jieba.__file__).parent / "dict.txt", encoding="utf-8"):
    w, f, *_ = line.split()
    if int(f) >= 3:
        dict_words.add(w)

df = collections.defaultdict(lambda: collections.Counter())   # word -> {grade: papers}
hcl = collections.defaultdict(lambda: collections.Counter())
examples = collections.defaultdict(list)
papers = collections.Counter()

for f in sorted(OCR.iterdir()):
    m = PAPER.match(f.name)
    if not m:
        continue
    grade, subj = f"P{m[1]}", m[2]
    text = f.read_text(encoding="utf-8", errors="ignore")
    papers[(grade, subj)] += 1
    seen = set()
    for sent in SENT_SPLIT.split(text):
        s = re.sub(r"\s+", "", sent)
        for chunk in CJK.findall(s):
            for w in jieba.cut(chunk, HMM=False):
                if len(w) >= 2 and w in dict_words:
                    seen.add(w)
        # keep short, fully-Chinese clause runs as example candidates (OCR wraps
        # lines mid-sentence, so sentences are rejoined above and re-cut at commas)
        if subj != "2" or not CLEAN_SENT.match(s.strip("，、：")):
            continue
        clauses = [c for c in s.split("，") if c]
        for i in range(len(clauses)):
            for j in range(i + 1, len(clauses) + 1):
                cand = "，".join(clauses[i:j])
                if len(cand) > 22:
                    break
                if len(cand) < 8:
                    continue
                for w in set(jieba.cut(cand, HMM=False)):
                    if len(w) >= 2 and len(examples[w]) < 12 and cand not in examples[w]:
                        examples[w].append(cand)
    target = df if subj == "2" else hcl
    for w in seen:
        target[w][grade] += 1

OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump({
    "papers": {f"{g}-{'CL' if s == '2' else 'HCL'}": n for (g, s), n in sorted(papers.items())},
    "words": {w: {"cl": dict(c), "hcl": dict(hcl.get(w, {})), "examples": examples.get(w, [])}
              for w, c in df.items()},
}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
print(dict(papers), len(df), "words ->", OUT)

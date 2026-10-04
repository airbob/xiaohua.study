"""Step 2: turn data/raw/word-stats.json into the practice word bank.

Output: data/words.json (also copied into public/ by the web app build).

Grade rule: a word belongs to the lowest grade whose papers use it often
enough (see THRESHOLD). The corpus has no P1 papers, so P1 is a hand-picked
list of first-year basics (data/p1-core.txt); those words are kept out of P2+.
"""
import json, re, collections
from pathlib import Path
from pypinyin import pinyin, Style

ROOT = Path(__file__).resolve().parent.parent
stats = json.load(open(ROOT / "data/raw/word-stats.json", encoding="utf-8"))
N = {"P2": 21, "P3": 84, "P4": 96, "P5": 107, "P6": 103}
GRADES = ["P2", "P3", "P4", "P5", "P6"]
# share of a grade's papers that must contain the word, and an absolute floor
THRESHOLD = {"P2": (0.19, 4), "P3": (0.10, 8), "P4": (0.10, 9), "P5": (0.09, 10), "P6": (0.09, 10)}
MAX_PER_GRADE = 360

# exam instructions, form fields and OCR boilerplate — frequent but not vocabulary
STOP = set("""
理解 短文 回答 词语 根据 代表 选出 填写 日期 班级 括号 答案 华文 汉语拼音 姓名 签名 家长 测验
成绩 试卷 选项 适当 提供 内容 阅读 句子 正确 高级 号码 横线 填空 搭配 上下文 改写 下列 以下
作答 总分 年终 画线 应用 语文 短语 一则 相应 详情 作者 文中 音节 数字 汉字 选择 问题 意思 选词
年级 一年级 二年级 三年级 四年级 五年级 六年级 得分 组成 看出 合理 下面 第一 第二 第三 文章
部分 段落 图片 图画 标点 符号 例子 例句 题目 写作 作文 考卷 口试 听力 朗读 一一 的话 以上
小乐 小明 小华 小美 小文 小红 小强 小英 小丽 小兰 小东 小玲 小龙 小刚 小芳 小云 一则 便条
上午 下午 地点 主题 资料 注意事项 填 页 节 段 篇 共 分 一题 两题 三题 四题 五题 每题 最适当
注音 格子 写出 组词 标点符号 拼音 量词 数目字 完整 我会 本书 词组 问答 序号 顺序 排列 第一课
考生 参考 考查 满分 分数 区区 乐乐 变变 答卷 短句 写明 字数 号数 词话 篇文章 体息 珍异 测试
每一项 其他同学 发现自己 是因为 预考 接下页 答答 篇章 会考 六月 政变 大悟 只限 参考答案 试题
书面 相近 附小 老病 日前 休息时间 数目 对话 提示 网址 我家 心想 本地 小组 词话 区区 以及
上课时 出门时 带回家 很着急 带我去 长长的 红着脸 低下头 低着头 很大 坐在 放在 留在 送到 拿走
很感兴趣 其他人 没什么 从来不 说不出 来看 有人 不得 不知 不了 不住 不到 做好 更好 说好 起到
还要 还有 那天 那位 这天 这项 这家 这种 这位 这部 这次 每人 每年 每个 地上 桌上 树上 楼下
先后顺序 遇到困难 在生活中 举例说明 下课后 长时间 是不是 有没有 出去玩 参赛者 报名费
回到 来到 走上 走过 走进 走出 拿出 接过 结出 进水 成名 学业 共用 听课 一时 前来 事后 之后
""".split())
SKIP_POS = {"nr", "nrfg", "nrt", "ns", "nt", "nz", "m", "mq", "x", "eng", "uj", "ul", "o", "e", "y"}

import jieba
pos = {}
for line in open(Path(jieba.__file__).parent / "dict.txt", encoding="utf-8"):
    w, f, p = line.split()
    pos[w] = p

gloss = {}
for line in open(ROOT / "data/raw/cedict.txt", encoding="utf-8"):
    if line.startswith("#"):
        continue
    m = re.match(r"^\S+ (\S+) \[[^\]]+\] /(.+)/$", line.strip())
    if m and m[1] not in gloss:
        senses = [s for s in m[2].split("/") if not s.startswith(("CL:", "variant of", "old variant", "surname "))]
        if senses:
            gloss[m[1]] = "; ".join(senses[:2])

def is_hanzi(w):
    return all("一" <= c <= "鿿" for c in w)

def py(w):
    return [s[0] for s in pinyin(w, style=Style.TONE, heteronym=False, neutral_tone_with_five=False)]

# character familiarity over example sentences — used to prefer clean examples
char_freq = collections.Counter()
for v in stats["words"].values():
    for s in v["examples"]:
        char_freq.update(s)

PUNCT = "，、：“”‘’《》（）"
# single characters that legitimately stand alone in a sentence
SINGLES = set("的了地得在是我你他她它们把被很也都就不要会说去来到有和跟给对着过上下里个一这那吗呢吧啊又还才只更最太真好大小多少想看听走跑吃喝做写读买拿用叫让请为从向往离比没再已可能该等快慢高长新老天年月日人家车门花树水书球钱猫狗鸟鱼")

def coverage(s):
    """Share of the sentence jieba can explain with dictionary words or very common
    single characters. OCR misreads (等可哥, 老王巴来) break into rare fragments."""
    good = 0
    for t in jieba.cut(s, HMM=False):
        if t in PUNCT:
            continue
        if (len(t) >= 2 and t in pos) or t in SINGLES:
            good += len(t)
    n = sum(1 for c in s if c not in PUNCT)
    return good / n if n else 0

def best_example(w, examples):
    good = [s for s in examples if w in s and 8 <= len(s) <= 22 and coverage(s) >= 0.9]
    if not good:
        return None
    s = max(good, key=lambda s: (coverage(s), min(char_freq[c] for c in s if c not in PUNCT), -abs(len(s) - 14)))
    s = s.strip("“”‘’《》，、：")
    return s.replace(w, "（" + "　" * len(w) + "）", 1)

p1 = [l.strip() for l in open(ROOT / "data/p1-core.txt", encoding="utf-8") if l.strip() and not l.startswith("#")]
p1_set = set(p1)

def entry(w, grade, freq=None, source="exam"):
    v = stats["words"].get(w, {"cl": {}, "examples": []})
    e = {"word": w, "pinyin": py(w), "grade": grade, "source": source}
    if w in gloss:
        e["en"] = gloss[w]
    ex = best_example(w, v["examples"])
    if ex:
        e["example"] = ex
    e["papers"] = {g: v["cl"][g] for g in GRADES if g in v["cl"]}
    return e

out = [entry(w, "P1", source="curriculum") for w in p1]
buckets = collections.defaultdict(list)
for w, v in stats["words"].items():
    if w in STOP or w in p1_set or not is_hanzi(w) or not 2 <= len(w) <= 4:
        continue
    if pos.get(w) in SKIP_POS:
        continue
    # 4-char entries must be idioms; jieba also lists plain phrases like 浪费时间
    if len(w) == 4 and pos.get(w) not in ("i", "l"):
        continue
    if w[-1] in "时的地着" or w[0] == "很":
        continue
    for g in GRADES:
        share, floor = THRESHOLD[g]
        n = v["cl"].get(g, 0)
        if n >= floor and n / N[g] >= share:
            buckets[g].append((n / N[g], w))
            break

for g in GRADES:
    for share, w in sorted(buckets[g], reverse=True)[:MAX_PER_GRADE]:
        out.append(entry(w, g))

seen_chars = set()
chars = {}
for g in ["P1"] + GRADES:
    new = []
    for e in out:
        if e["grade"] == g:
            for c in e["word"]:
                if c not in seen_chars:
                    seen_chars.add(c); new.append(c)
    chars[g] = "".join(new)

meta = {
    "source": "sgexamhub.com Chinese Language papers (OCR), P2–P6; P1 hand-curated",
    "papers": stats["papers"],
    "counts": {g: sum(1 for e in out if e["grade"] == g) for g in ["P1"] + GRADES},
    "glossSource": "CC-CEDICT (CC BY-SA 4.0)",
}
json.dump({"meta": meta, "chars": chars, "words": out},
          open(ROOT / "data/words.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(meta["counts"], {g: len(c) for g, c in chars.items()})

# slim copy bundled into the web app
app = [{k: e[k] for k in ("word", "pinyin", "grade", "en", "example") if k in e} for e in out]
(ROOT / "src/data").mkdir(parents=True, exist_ok=True)
json.dump(app, open(ROOT / "src/data/words.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

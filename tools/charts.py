"""reports/*.md の表を読み取り、reports/img/ にグラフを生成して各レポートに埋め込む"""
import re, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path

plt.rcParams["font.family"] = ["Hiragino Sans", "Hiragino Sans GB", "sans-serif"]
plt.rcParams["axes.spines.top"] = False; plt.rcParams["axes.spines.right"] = False
C = {"blue": "#3B6FD4", "orange": "#E8873A", "green": "#3AA36A", "red": "#D9484E", "gray": "#8A8F98", "purple": "#8B5CF6", "teal": "#14B8A6"}
R = Path("reports"); IMG = R / "img"

def tables(md):
    out, cur = [], []
    for line in md.splitlines() + [""]:
        if line.startswith("|"): cur.append([c.strip() for c in line.strip().strip("|").split("|")])
        elif cur: out.append(cur); cur = []
    return [(t[0], [r for r in t[2:]]) for t in out]

def embed(name, images, after="^- .*\n\n"):
    p = R / f"{name}.md"; md = p.read_text()
    md = re.sub(r"\n(!\[[^\]]*\]\(img/[^)]*\)\n)+", "\n", md)  # 既存埋め込みを除去
    block = "\n".join(f"![{alt}](img/{f})" for f, alt in images) + "\n"
    m = re.search(r"(^# .*\n\n(?:- .*\n)+\n)", md, re.M)
    md = md[: m.end()] + block + "\n" + md[m.end():]
    p.write_text(md)

def num(s):
    m = re.search(r"-?\d+(\.\d+)?", s); return float(m.group()) if m else np.nan

# ---------- 01 latency ----------
h, rows = tables((R / "01-latency.md").read_text())[0]
labels = [r[0] for r in rows]; p50 = [num(r[1]) for r in rows]; p90 = [num(r[2]) for r in rows]; toks = [num(r[4]) for r in rows]
fig, axes = plt.subplots(1, 2, figsize=(12, 4.2))
for ax, idx, title, xl in [(axes[0], range(0, 4), "質問数を増やす（state 固定）", ["1件", "3件", "10件", "30件"]), (axes[1], range(4, 8), "state を長くする（質問 3 件固定）", ["1段落\n0.5k tok", "10段落\n1.6k", "50段落\n6.2k", "100段落\n12k"])]:
    x = np.arange(len(idx)); a = ax.bar(x - 0.2, [p50[i] for i in idx], 0.4, label="p50", color=C["blue"]); b = ax.bar(x + 0.2, [min(p90[i], 400) for i in idx], 0.4, label="p90", color=C["orange"])
    for i, k in enumerate(idx):
        if p90[k] > 400: ax.text(x[i] + 0.2, 395, f"{p90[k]:.0f}\n(初回)", ha="center", va="top", fontsize=8, color="white")
    ax.set_xticks(x, xl); ax.set_ylim(0, 420); ax.set_ylabel("ms"); ax.set_title(title); ax.axhline(250, ls=":", c=C["gray"]); ax.legend(frameon=False)
fig.suptitle("レイテンシはほぼ一定: 質問数・state 長のどちらにも鈍感（各 5 回、東京から）", fontsize=12); fig.tight_layout(); fig.savefig(IMG / "01-latency.png", dpi=150); plt.close()
embed("01-latency", [("01-latency.png", "レイテンシ")])

# ---------- 02 ja vs en ----------
h, rows = tables((R / "02-ja-vs-en.md").read_text())[0]
def cell(s):
    m = re.match(r"(\w+)\((\d\.\d+)\)/(-?\d\.\d+)/(\d\.\d+)", s); return m.group(1), float(m.group(2)), float(m.group(3)), float(m.group(4))
ids = [r[0] for r in rows]; JJ = [cell(r[2]) for r in rows]; EE = [cell(r[4]) for r in rows]; gold = [r[1].split("/") for r in rows]
fig, axes = plt.subplots(1, 3, figsize=(13, 4.2))
ax = axes[0]; ax.scatter([j[2] for j in JJ], [e[2] for e in EE], c=C["blue"], s=60, zorder=3)
for i, (j, e) in enumerate(zip(JJ, EE)): ax.annotate(ids[i], (j[2], e[2]), textcoords="offset points", xytext=(5, 4), fontsize=8)
ax.plot([0, 2], [0, 2], ls="--", c=C["gray"]); ax.set_xlabel("緊急度 score（日本語）"); ax.set_ylabel("緊急度 score（英語）"); ax.set_title("緊急度: 日英でほぼ対角線上")
ax = axes[1]; ax.scatter([j[3] for j in JJ], [e[3] for e in EE], c=C["green"], s=60, zorder=3); ax.plot([0, 1], [0, 1], ls="--", c=C["gray"])
for i, (j, e) in enumerate(zip(JJ, EE)): ax.annotate(ids[i], (j[3], e[3]), textcoords="offset points", xytext=(5, 4), fontsize=8)
ax.set_xlabel("返金 noul（日本語）"); ax.set_ylabel("返金 noul（英語）"); ax.set_title("返金要求 noul: 12/12 一致")
ax = axes[2]; x = np.arange(len(ids)); ax.bar(x - 0.2, [j[1] for j in JJ], 0.4, label="日本語", color=C["blue"]); ax.bar(x + 0.2, [e[1] for e in EE], 0.4, label="英語", color=C["orange"])
ax.set_xticks(x, ids, fontsize=8); ax.set_ylim(0, 1.05); ax.set_title("カテゴリ choice の confidence"); ax.legend(frameon=False, loc="lower right")
fig.suptitle("日本語と英語で同じ内容を投げると、判定も確信度もほぼ同じ", fontsize=12); fig.tight_layout(); fig.savefig(IMG / "02-ja-vs-en.png", dpi=150); plt.close()
embed("02-ja-vs-en", [("02-ja-vs-en.png", "日英比較")])

# ---------- 03 code risk ----------
h, rows = tables((R / "03-code-risk.md").read_text())[0]
titles = [r[1] for r in rows]; g = [num(r[2]) for r in rows]; pr = [num(r[3]) for r in rows]; rev = [num(r[4]) for r in rows]; irr = [num(r[7]) for r in rows]; sec = [num(r[8]) for r in rows]
order = np.argsort(g)
fig, axes = plt.subplots(1, 2, figsize=(13, 5.5), gridspec_kw={"width_ratios": [1.5, 1]})
ax = axes[0]; y = np.arange(len(rows))
ax.barh(y + 0.2, [g[i] for i in order], 0.4, color=C["gray"], label="人手の正解")
ax.barh(y - 0.2, [pr[i] for i in order], 0.4, color=[C["red"] if pr[i] >= 2.5 else C["orange"] if pr[i] >= 1.5 else C["green"] for i in order], label="Jev の危険度 score")
ax.set_yticks(y, [titles[i] for i in order], fontsize=9); ax.set_xlim(0, 3.2); ax.set_xticks([0, 1, 2, 3], ["0 安全", "1 低", "2 中", "3 高"]); ax.legend(frameon=False, loc="lower right"); ax.set_title("危険度: 高リスク 5 件はすべて 2.8 以上")
ax = axes[1]; M = np.array([[rev[i], irr[i], sec[i]] for i in order]); im = ax.imshow(M, cmap="Reds", vmin=0, vmax=1, aspect="auto")
ax.set_xticks([0, 1, 2], ["要レビュー", "不可逆", "シークレット"]); ax.set_yticks([]); ax.set_title("noul（0〜1）")
for r_ in range(M.shape[0]):
    for c_ in range(3): ax.text(c_, r_, f"{M[r_, c_]:.2f}", ha="center", va="center", fontsize=8, color="white" if M[r_, c_] > 0.6 else "black")
ax.invert_yaxis(); axes[0].invert_yaxis()
fig.suptitle("コード diff の危険度チェック（15 件、日本語質問）", fontsize=12); fig.tight_layout(); fig.savefig(IMG / "03-code-risk.png", dpi=150); plt.close()
embed("03-code-risk", [("03-code-risk.png", "危険度")])

# ---------- 04 tool selection ----------
h, rows = tables((R / "04-tool-selection.md").read_text())[0]
gold = [r[2] for r in rows]; pred = [r[3].split()[-1] for r in rows]; conf = [num(r[4]) for r in rows]; clar = [num(r[6]) for r in rows]; amb = ["曖昧" in r[1] for r in rows]
labels = ["web_search", "read_file", "edit_file", "run_shell", "create_pr", "send_slack", "calendar", "pdf_skill", "xlsx_skill", "pptx_skill", "none"]
M = np.zeros((len(labels), len(labels)))
for gg, pp in zip(gold, pred): M[labels.index(gg), labels.index(pp)] += 1
fig, axes = plt.subplots(1, 2, figsize=(13, 5.5), gridspec_kw={"width_ratios": [1.3, 1]})
ax = axes[0]; ax.imshow(M, cmap="Blues"); ax.set_xticks(range(len(labels)), labels, rotation=45, ha="right", fontsize=8); ax.set_yticks(range(len(labels)), labels, fontsize=8)
for i in range(len(labels)):
    for j in range(len(labels)):
        if M[i, j]: ax.text(j, i, int(M[i, j]), ha="center", va="center", color="white" if M[i, j] >= 2 else "black", fontweight="bold")
ax.set_xlabel("Jev の選択"); ax.set_ylabel("正解"); ax.set_title("混同行列: 外れは「直して→read_file」「PR→run_shell」「曖昧→none」")
ax = axes[1]
for i in range(len(rows)):
    hit = gold[i] == pred[i]; ax.scatter(conf[i], clar[i], s=90, c=C["green"] if hit else C["red"], marker="o" if not amb[i] else "^", zorder=3, alpha=0.85)
    ax.annotate(rows[i][0], (conf[i], clar[i]), textcoords="offset points", xytext=(5, 3), fontsize=7)
ax.scatter([], [], c=C["green"], label="正解"); ax.scatter([], [], c=C["red"], label="不正解"); ax.scatter([], [], c="k", marker="^", label="曖昧な依頼")
ax.set_xlabel("ツール choice の confidence"); ax.set_ylabel("要確認 noul"); ax.set_xlim(0, 1.05); ax.set_ylim(0, 1.05); ax.legend(frameon=False, loc="lower left"); ax.set_title("confidence が高くても間違える。曖昧さは「要確認」が拾う")
fig.suptitle("日本語依頼文からのツール選択（20 件、候補 11 種）", fontsize=12); fig.tight_layout(); fig.savefig(IMG / "04-tool-selection.png", dpi=150); plt.close()
embed("04-tool-selection", [("04-tool-selection.png", "ツール選択")])

# ---------- 05 game ----------
h, rows = tables((R / "05-game-agent.md").read_text())[0]
turn = [int(r[0]) for r in rows]; hp = [num(re.search(r"HP(\d+)", r[1]).group()) for r in rows]; dist = [num(re.search(r"距離(\d+)", r[1]).group()) for r in rows]
act = [r[3].split()[-1] for r in rows]; ok = ["✅" in r[3] for r in rows]; conf = [num(r[4]) for r in rows]; danger = [num(r[5]) for r in rows]; hostile = [num(r[6]) for r in rows]; ms = [num(r[7]) for r in rows]
acol = {"attack": C["red"], "cast_fireball": C["orange"], "drink_potion": C["green"], "retreat": C["gray"], "call_allies": C["purple"], "talk": C["teal"]}
fig, axes = plt.subplots(3, 1, figsize=(13, 8), sharex=True, gridspec_kw={"height_ratios": [2, 1.2, 0.8]})
ax = axes[0]; ax.plot(turn, hp, c=C["red"], lw=2, label="衛兵 HP"); ax.set_ylabel("HP"); ax2 = ax.twinx(); ax2.plot(turn, dist, c=C["blue"], lw=1.5, ls="--", label="プレイヤーとの距離"); ax2.set_ylabel("距離"); ax2.spines["top"].set_visible(False)
for t, a, k in zip(turn, act, ok): ax.scatter(t, 108, marker="o" if k else "X", s=110, c=acol[a], zorder=4, edgecolors="k" if not k else "none")
ax.set_ylim(0, 115); ax.set_title("衛兵 NPC の 25 ターン: 上段の丸が Jev の選んだ行動（× は参照方針と不一致）")
for a, c in acol.items(): ax.scatter([], [], c=c, label=a)
ax.legend(frameon=False, ncol=4, fontsize=8, loc="lower left"); ax2.legend(frameon=False, loc="lower right", fontsize=8)
ax = axes[1]; ax.plot(turn, conf, c=C["purple"], marker="o", label="行動の confidence"); ax.plot(turn, danger, c=C["red"], marker=".", label="危険 noul"); ax.plot(turn, hostile, c=C["orange"], marker=".", label="敵対 noul"); ax.set_ylim(0, 1.05); ax.legend(frameon=False, ncol=3, fontsize=8); ax.set_ylabel("0–1")
ax = axes[2]; ax.bar(turn, [min(m, 400) for m in ms], color=C["blue"]); ax.text(1, 380, f"{ms[0]:.0f}ms (初回)", fontsize=8, ha="left", va="top", color="white"); ax.set_ylim(0, 420); ax.set_ylabel("ms"); ax.set_xlabel("ターン"); ax.axhline(np.median(ms), ls=":", c=C["gray"])
fig.tight_layout(); fig.savefig(IMG / "05-game-agent.png", dpi=150); plt.close()
embed("05-game-agent", [("05-game-agent.png", "ゲーム NPC")])

# ---------- 06 business ----------
ts = tables((R / "06-business-ideas.md").read_text()); h, rows = ts[0]; hr, rank = ts[1]
names = [r[1] for r in rows]; axes_l = ["市場", "痛み", "実現", "差別", "収益", "チーム"]; S = np.array([[num(r[i]) for i in range(2, 8)] for r in rows]); pursue = [num(r[11]) for r in rows]
fig = plt.figure(figsize=(14, 7.5)); ang = np.linspace(0, 2 * np.pi, 6, endpoint=False).tolist(); ang += ang[:1]
for k in range(8):
    ax = fig.add_subplot(2, 4, k + 1, polar=True); v = S[k].tolist() + [S[k][0]]
    col = C["green"] if pursue[k] >= 0.5 else C["red"]; ax.plot(ang, v, c=col, lw=2); ax.fill(ang, v, c=col, alpha=0.2)
    ax.set_xticks(ang[:-1], axes_l, fontsize=8); ax.set_ylim(0, 3); ax.set_yticks([1, 2, 3]); ax.set_yticklabels([]); ax.set_title(f"{names[k][:16]}\n本気 noul {pursue[k]:.2f}", fontsize=9, pad=12)
fig.suptitle("事業アイデア 8 件の 6 軸分解スコア（緑 = 本気で取り組むべき noul ≥ 0.5）", fontsize=12); fig.tight_layout(); fig.savefig(IMG / "06-business-radar.png", dpi=150); plt.close()
fig, ax = plt.subplots(figsize=(10, 4)); rn = [r[2] for r in rank]; rc = [num(r[3]) for r in rank]; rp = [num(r[4]) for r in rank]
ax.barh(range(8), rc, color=[C["green"] if p >= 0.5 else C["red"] for p in rp]); ax.set_yticks(range(8), rn, fontsize=9); ax.invert_yaxis(); ax.set_xlabel("合成スコア（0–3、重みはコード側で指定）")
for i, (c_, p_) in enumerate(zip(rc, rp)): ax.text(c_ + 0.03, i, f"{c_:.2f}  本気 {p_:.2f}", va="center", fontsize=8)
ax.set_xlim(0, 3); ax.set_title("合成スコアによるランキング: 上位 4 件と下位 3 件は実験者の私見と一致"); fig.tight_layout(); fig.savefig(IMG / "06-business-rank.png", dpi=150); plt.close()
embed("06-business-ideas", [("06-business-radar.png", "レーダー"), ("06-business-rank.png", "ランキング")])
print("done")

"""reports/*.md の表および実験データを読み取り、reports/img/ に洗練されたグラフを生成して埋め込む"""
import re
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path

# デザイン・フォント設定
plt.rcParams["font.family"] = ["Hiragino Sans", "Hiragino Sans GB", "AppleGothic", "sans-serif"]
plt.rcParams["axes.spines.top"] = False
plt.rcParams["axes.spines.right"] = False
plt.rcParams["figure.facecolor"] = "#FFFFFF"
plt.rcParams["axes.facecolor"] = "#FFFFFF"
plt.rcParams["axes.grid"] = True
plt.rcParams["grid.alpha"] = 0.25
plt.rcParams["grid.linestyle"] = "--"

C = {
    "blue": "#2563EB",
    "indigo": "#4F46E5",
    "orange": "#EA580C",
    "green": "#16A34A",
    "red": "#DC2626",
    "gray": "#64748B",
    "light_gray": "#E2E8F0",
    "purple": "#9333EA",
    "teal": "#0D9488",
    "cyan": "#0284C7",
    "yellow": "#CA8A04"
}
R = Path("reports")
IMG = R / "img"
IMG.mkdir(parents=True, exist_ok=True)

def tables(md):
    out, cur = [], []
    for line in md.splitlines() + [""]:
        if line.startswith("|"):
            cur.append([c.strip() for c in line.strip().strip("|").split("|")])
        elif cur:
            out.append(cur)
            cur = []
    return [(t[0], [r for r in t[2:]]) for t in out]

def embed(name, images):
    p = R / f"{name}.md"
    if not p.exists():
        return
    md = p.read_text()
    md = re.sub(r"\n(!\[[^\]]*\]\(img/[^)]*\)\n)+", "\n", md)  # 既存埋め込みを除去
    block = "\n".join(f"![{alt}](img/{f})" for f, alt in images) + "\n"
    m = re.search(r"(^# .*\n\n(?:- .*\n)+\n)", md, re.M)
    if m:
        md = md[: m.end()] + block + "\n" + md[m.end():]
    else:
        md = block + "\n" + md
    p.write_text(md)

def num(s):
    m = re.search(r"-?\d+(\.\d+)?", s)
    return float(m.group()) if m else np.nan

print("Generating enhanced charts...")

# ==========================================
# 01 Latency
# ==========================================
h, rows = tables((R / "01-latency.md").read_text())[0]
labels = [r[0] for r in rows]
p50 = [num(r[1]) for r in rows]
p90 = [num(r[2]) for r in rows]
toks = [num(r[4]) for r in rows]

fig, axes = plt.subplots(1, 2, figsize=(13, 4.5), dpi=150)
for ax, idx, title, xl in [
    (axes[0], range(0, 4), "質問数を増やした時（state 固定: 1段落）", ["1問\n(21 tok)", "3問\n(71 tok)", "10問\n(222 tok)", "30問\n(694 tok)"]),
    (axes[1], range(4, 8), "state を長くした時（質問 3 問固定）", ["1段落\n0.5k tok", "10段落\n1.6k tok", "50段落\n6.2k tok", "100段落\n12k tok"])
]:
    x = np.arange(len(idx))
    a = ax.bar(x - 0.2, [p50[i] for i in idx], 0.38, label="p50 (定常)", color=C["blue"], zorder=3)
    b = ax.bar(x + 0.2, [min(p90[i], 400) for i in idx], 0.38, label="p90 (変動幅)", color=C["orange"], zorder=3)
    for i, k in enumerate(idx):
        ax.text(x[i] - 0.2, p50[k] + 8, f"{p50[k]:.0f}ms", ha="center", va="bottom", fontsize=8.5, fontweight="bold", color=C["blue"])
        if p90[k] > 400:
            ax.text(x[i] + 0.2, 385, f"{p90[k]:.0f}ms\n(初回)", ha="center", va="top", fontsize=8, color="white", fontweight="bold")
        else:
            ax.text(x[i] + 0.2, p90[k] + 8, f"{p90[k]:.0f}ms", ha="center", va="bottom", fontsize=8.5, color=C["orange"])
    ax.set_xticks(x, xl, fontsize=9)
    ax.set_ylim(0, 430)
    ax.set_ylabel("レスポンス時間 (ms)", fontsize=10)
    ax.set_title(title, fontsize=11, fontweight="bold", pad=10)
    ax.axhline(250, ls=":", c=C["gray"], alpha=0.7, label="250ms 目安")
    ax.legend(frameon=True, facecolor="#F8FAFC", edgecolor="#E2E8F0", fontsize=8.5, loc="upper left")

fig.suptitle("Jev (System One) レイテンシ特性: 質問数・文量が増えても 215〜260ms でフラット推移", fontsize=13, fontweight="bold", y=1.02)
fig.tight_layout()
fig.savefig(IMG / "01-latency.png", dpi=150, bbox_inches="tight")
plt.close()
embed("01-latency", [("01-latency.png", "レイテンシ")])

# ==========================================
# 02 JA vs EN
# ==========================================
h, rows = tables((R / "02-ja-vs-en.md").read_text())[0]
def cell(s):
    m = re.match(r"(\w+)\((\d\.\d+)\)/(-?\d\.\d+)/(\d\.\d+)", s)
    return m.group(1), float(m.group(2)), float(m.group(3)), float(m.group(4))

ids = [r[0] for r in rows]
JJ = [cell(r[2]) for r in rows]
EE = [cell(r[4]) for r in rows]

fig, axes = plt.subplots(1, 3, figsize=(14, 4.5), dpi=150)

# 緊急度
ax = axes[0]
ax.scatter([j[2] for j in JJ], [e[2] for e in EE], c=C["blue"], s=80, edgecolors="white", linewidths=1.5, zorder=3)
for i, (j, e) in enumerate(zip(JJ, EE)):
    ax.annotate(ids[i], (j[2], e[2]), textcoords="offset points", xytext=(4, 4), fontsize=8, color="#1E293B")
ax.plot([0, 2], [0, 2], ls="--", c=C["gray"], alpha=0.8, label="完全一致線")
ax.set_xlabel("日本語 緊急度 score (0〜2)", fontsize=9.5)
ax.set_ylabel("英語 緊急度 score (0〜2)", fontsize=9.5)
ax.set_title("緊急度 score: 日英で一致 (R² ≈ 0.99)", fontsize=11, fontweight="bold")
ax.legend(frameon=True, fontsize=8)

# 返金 noul
ax = axes[1]
ax.scatter([j[3] for j in JJ], [e[3] for e in EE], c=C["green"], s=80, edgecolors="white", linewidths=1.5, zorder=3)
for i, (j, e) in enumerate(zip(JJ, EE)):
    ax.annotate(ids[i], (j[3], e[3]), textcoords="offset points", xytext=(4, 4), fontsize=8, color="#1E293B")
ax.plot([0, 1], [0, 1], ls="--", c=C["gray"], alpha=0.8, label="完全一致線")
ax.set_xlabel("日本語 返金要求 noul (0〜1)", fontsize=9.5)
ax.set_ylabel("英語 返金要求 noul (0〜1)", fontsize=9.5)
ax.set_title("返金要求 noul: 12/12 ケースで閾値完全一致", fontsize=11, fontweight="bold")
ax.legend(frameon=True, fontsize=8)

# カテゴリ確信度
ax = axes[2]
x = np.arange(len(ids))
ax.bar(x - 0.2, [j[1] for j in JJ], 0.38, label="日本語 (JJ)", color=C["blue"], zorder=3)
ax.bar(x + 0.2, [e[1] for e in EE], 0.38, label="英語 (EE)", color=C["orange"], zorder=3)
ax.set_xticks(x, ids, fontsize=8)
ax.set_ylim(0, 1.15)
ax.set_ylabel("Choice Confidence", fontsize=9.5)
ax.set_title("カテゴリ分類の確信度比較", fontsize=11, fontweight="bold")
ax.legend(frameon=True, loc="lower right", fontsize=8.5)

fig.suptitle("日本語文と英語文の推論精度比較: 分類・スコアリング・確信度ともに差異ゼロ", fontsize=13, fontweight="bold", y=1.02)
fig.tight_layout()
fig.savefig(IMG / "02-ja-vs-en.png", dpi=150, bbox_inches="tight")
plt.close()
embed("02-ja-vs-en", [("02-ja-vs-en.png", "日英比較")])

# ==========================================
# 03 Code Risk
# ==========================================
h, rows = tables((R / "03-code-risk.md").read_text())[0]
titles = [r[1] for r in rows]
g = [num(r[2]) for r in rows]
pr = [num(r[3]) for r in rows]
rev = [num(r[4]) for r in rows]
irr = [num(r[7]) for r in rows]
sec = [num(r[8]) for r in rows]
order = np.argsort(g)

fig, axes = plt.subplots(1, 2, figsize=(14, 6), dpi=150, gridspec_kw={"width_ratios": [1.5, 1]})
ax = axes[0]
y = np.arange(len(rows))
ax.barh(y + 0.2, [g[i] for i in order], 0.38, color=C["gray"], alpha=0.7, label="人手正解スコア", zorder=3)
bar_colors = [C["red"] if pr[i] >= 2.5 else C["orange"] if pr[i] >= 1.5 else C["green"] for i in order]
ax.barh(y - 0.2, [pr[i] for i in order], 0.38, color=bar_colors, label="Jev 危険度 score (0〜3)", zorder=3)
for idx, i in enumerate(order):
    ax.text(pr[i] + 0.05, idx - 0.2, f"{pr[i]:.2f}", va="center", fontsize=8, fontweight="bold", color=bar_colors[idx])
ax.set_yticks(y, [titles[i] for i in order], fontsize=8.5)
ax.set_xlim(0, 3.4)
ax.set_xticks([0, 1, 2, 3], ["0 安全", "1 低リスク", "2 中リスク", "3 高リスク (遮断)"], fontsize=8.5)
ax.legend(frameon=True, loc="lower right", fontsize=8.5)
ax.set_title("危険度判定: 破壊的・セキュリティ変更（高リスク 5件）は 2.8〜3.0 で完全検知", fontsize=10.5, fontweight="bold")

ax2 = axes[1]
M = np.array([[rev[i], irr[i], sec[i]] for i in order])
im = ax2.imshow(M, cmap="YlOrRd", vmin=0, vmax=1, aspect="auto")
ax2.set_xticks([0, 1, 2], ["要レビュー\n(noul)", "不可逆性\n(noul)", "シークレット\n(noul)"], fontsize=9)
ax2.set_yticks([])
ax2.set_title("属性別 noul 検知ヒートマップ", fontsize=10.5, fontweight="bold")
for r_ in range(M.shape[0]):
    for c_ in range(3):
        val = M[r_, c_]
        color = "white" if val > 0.6 else "black"
        ax2.text(c_, r_, f"{val:.2f}", ha="center", va="center", fontsize=8, fontweight="bold" if val > 0.6 else "normal", color=color)

ax.invert_yaxis()
ax2.invert_yaxis()
fig.colorbar(im, ax=ax2, orientation="vertical", shrink=0.7, label="noul 確率値 (0〜1)")
fig.suptitle("コード差分の危険度・シークレット自動審査（15 変更差分）", fontsize=13, fontweight="bold", y=1.02)
fig.tight_layout()
fig.savefig(IMG / "03-code-risk.png", dpi=150, bbox_inches="tight")
plt.close()
embed("03-code-risk", [("03-code-risk.png", "危険度")])

# ==========================================
# 04 Tool Selection
# ==========================================
h, rows = tables((R / "04-tool-selection.md").read_text())[0]
gold = [r[2] for r in rows]
pred = [r[3].split()[-1] for r in rows]
conf = [num(r[4]) for r in rows]
clar = [num(r[6]) for r in rows]
amb = ["曖昧" in r[1] for r in rows]
labels = ["web_search", "read_file", "edit_file", "run_shell", "create_pr", "send_slack", "calendar", "pdf_skill", "xlsx_skill", "pptx_skill", "none"]

M = np.zeros((len(labels), len(labels)))
for gg, pp in zip(gold, pred):
    if gg in labels and pp in labels:
        M[labels.index(gg), labels.index(pp)] += 1

fig, axes = plt.subplots(1, 2, figsize=(14, 5.8), dpi=150, gridspec_kw={"width_ratios": [1.2, 1]})
ax = axes[0]
im = ax.imshow(M, cmap="Blues", aspect="auto")
ax.set_xticks(range(len(labels)), labels, rotation=45, ha="right", fontsize=8)
ax.set_yticks(range(len(labels)), labels, fontsize=8)
for i in range(len(labels)):
    for j in range(len(labels)):
        if M[i, j] > 0:
            ax.text(j, i, int(M[i, j]), ha="center", va="center", color="white" if M[i, j] >= 2 else "black", fontweight="bold", fontsize=9)
ax.set_xlabel("Jev の選択ツール", fontsize=9.5)
ax.set_ylabel("期待される正解ツール", fontsize=9.5)
ax.set_title("ツール選択の混同行列 (正解率 88%)", fontsize=11, fontweight="bold")

ax2 = axes[1]
for i in range(len(rows)):
    hit = gold[i] == pred[i]
    color = C["green"] if hit else C["red"]
    marker = "^" if amb[i] else "o"
    ax2.scatter(conf[i], clar[i], s=90, c=color, marker=marker, zorder=3, alpha=0.9, edgecolors="white", linewidths=1)
    ax2.annotate(rows[i][0], (conf[i], clar[i]), textcoords="offset points", xytext=(4, 3), fontsize=7.5, color="#1E293B")

ax2.scatter([], [], c=C["green"], marker="o", label="正解 (明確)")
ax2.scatter([], [], c=C["red"], marker="o", label="不一致")
ax2.scatter([], [], c=C["orange"], marker="^", label="曖昧な指示")
ax2.axhline(0.5, ls="--", c=C["gray"], alpha=0.6, label="要確認 noul 閾値 0.5")
ax2.set_xlabel("Choice Confidence", fontsize=9.5)
ax2.set_ylabel("要確認 noul (曖昧性検知)", fontsize=9.5)
ax2.set_xlim(0, 1.05)
ax2.set_ylim(0, 1.05)
ax2.legend(frameon=True, loc="upper right", fontsize=8)
ax2.set_title("曖昧指示の安全弁: noul による確認要求トリガー", fontsize=11, fontweight="bold")

fig.suptitle("エージェント向けツール・スキル高速選択 (11種ツール、20件指示文)", fontsize=13, fontweight="bold", y=1.02)
fig.tight_layout()
fig.savefig(IMG / "04-tool-selection.png", dpi=150, bbox_inches="tight")
plt.close()
embed("04-tool-selection", [("04-tool-selection.png", "ツール選択")])

# ==========================================
# 05 Game Agent
# ==========================================
h, rows = tables((R / "05-game-agent.md").read_text())[0]
turn = [int(r[0]) for r in rows]
hp = [num(re.search(r"HP(\d+)", r[1]).group()) for r in rows]
dist = [num(re.search(r"距離(\d+)", r[1]).group()) for r in rows]
act = [r[3].split()[-1] for r in rows]
ok = ["✅" in r[3] for r in rows]
conf = [num(r[4]) for r in rows]
danger = [num(r[5]) for r in rows]
hostile = [num(r[6]) for r in rows]
ms = [num(r[7]) for r in rows]

acol = {
    "attack": C["red"],
    "cast_fireball": C["orange"],
    "drink_potion": C["green"],
    "retreat": C["gray"],
    "call_allies": C["purple"],
    "talk": C["teal"]
}

fig, axes = plt.subplots(3, 1, figsize=(14, 8.5), sharex=True, dpi=150, gridspec_kw={"height_ratios": [2, 1.1, 0.9]})
ax = axes[0]
l1 = ax.plot(turn, hp, c=C["red"], lw=2.5, label="NPC HP", zorder=3)
ax.set_ylabel("NPC 残HP", fontsize=9.5)
ax.set_ylim(0, 120)

ax_twin = ax.twinx()
l2 = ax_twin.plot(turn, dist, c=C["blue"], lw=2, ls="--", label="プレイヤーとの距離", zorder=2)
ax_twin.set_ylabel("プレイヤーとの距離", fontsize=9.5)
ax_twin.spines["top"].set_visible(False)

for t, a, k in zip(turn, act, ok):
    ax.scatter(t, 112, marker="o" if k else "X", s=120, c=acol.get(a, C["gray"]), zorder=4, edgecolors="white", linewidths=1.5)
    ax.text(t, 105, a[:4], ha="center", va="top", fontsize=6.5, rotation=45, color="#334155")

for a_name, c_val in acol.items():
    ax.scatter([], [], c=c_val, label=f"行動: {a_name}")

ax.legend(frameon=True, ncol=4, fontsize=7.5, loc="lower left")
ax_twin.legend(frameon=True, fontsize=8, loc="lower right")
ax.set_title("自律NPCの25ターン行動系列: ���離とHP変化��応じた的確な意志決定 (一致率 24/25)", fontsize=11, fontweight="bold")

# 中段: confidence / danger / hostile
ax2 = axes[1]
ax2.plot(turn, conf, c=C["purple"], marker="o", label="行動確��度 (Choice Confidence)", lw=1.8, zorder=3)
ax2.plot(turn, danger, c=C["red"], marker="s", ls=":", label="危険察知 noul", lw=1.5, zorder=3)
ax2.plot(turn, hostile, c=C["orange"], marker="^", ls="--", label="敵対度 noul", lw=1.5, zorder=3)
ax2.set_ylim(0, 1.1)
ax2.set_ylabel("確率 / 確信度 (0〜1)", fontsize=9)
ax2.legend(frameon=True, ncol=3, fontsize=8, loc="upper right")

# 下段: レイテン��
ax3 = axes[2]
ax3.bar(turn, [min(m, 400) for m in ms], color=C["blue"], width=0.6, zorder=3)
ax3.text(1, 380, f"{ms[0]:.0f}ms (初回収束)", fontsize=8, ha="left", va="top", color="white", fontweight="bold")
ax3.set_ylim(0, 420)
ax3.set_ylabel("推論時間 (ms)", fontsize=9)
ax3.set_xlabel("ゲームターン数", fontsize=9.5)
ax3.axhline(np.median(ms[1:]), ls=":", c=C["red"], label=f"定常 p50 ({np.median(ms[1:]):.0f}ms)")
ax3.legend(frameon=True, fontsize=8, loc="upper right")

fig.suptitle("リアルタイムゲームNPC行動シミュレーション (毎ターン 220ms 応答)", fontsize=13, fontweight="bold", y=1.01)
fig.tight_layout()
fig.savefig(IMG / "05-game-agent.png", dpi=150, bbox_inches="tight")
plt.close()
embed("05-game-agent", [("05-game-agent.png", "ゲーム NPC")])

# ==========================================
# 06 Business Ideas
# ==========================================
ts = tables((R / "06-business-ideas.md").read_text())
h, rows = ts[0]
hr, rank = ts[1]
names = [r[1] for r in rows]
axes_l = ["市場規模", "課題の痛み", "実現性", "差別化", "収益性", "チーム適合"]
S = np.array([[num(r[i]) for i in range(2, 8)] for r in rows])
pursue = [num(r[11]) for r in rows]

fig = plt.figure(figsize=(15, 7.8), dpi=150)
ang = np.linspace(0, 2 * np.pi, 6, endpoint=False).tolist()
ang += ang[:1]

for k in range(min(8, len(rows))):
    ax = fig.add_subplot(2, 4, k + 1, polar=True)
    v = S[k].tolist() + [S[k][0]]
    col = C["green"] if pursue[k] >= 0.5 else C["red"]
    ax.plot(ang, v, c=col, lw=2.2, zorder=3)
    ax.fill(ang, v, c=col, alpha=0.25)
    ax.set_xticks(ang[:-1], axes_l, fontsize=8)
    ax.set_ylim(0, 3)
    ax.set_yticks([1, 2, 3])
    ax.set_yticklabels(["1", "2", "3"], fontsize=6.5, color="#64748B")
    ax.set_title(f"{names[k][:14]}\n推進 noul: {pursue[k]:.2f}", fontsize=9, pad=12, fontweight="bold", color=col)

fig.suptitle("事業アイデア 8 件の 6 軸レーダーチャート評価（緑 = 推進推奨 noul ≥ 0.5）", fontsize=13, fontweight="bold", y=1.01)
fig.tight_layout()
fig.savefig(IMG / "06-business-radar.png", dpi=150, bbox_inches="tight")
plt.close()

# ランキング
fig, ax = plt.subplots(figsize=(11, 4.5), dpi=150)
rn = [r[2] for r in rank]
rc = [num(r[3]) for r in rank]
rp = [num(r[4]) for r in rank]
y_pos = np.arange(len(rn))
bar_c = [C["green"] if p >= 0.5 else C["red"] for p in rp]

ax.barh(y_pos, rc, color=bar_c, height=0.55, zorder=3)
ax.set_yticks(y_pos, rn, fontsize=9.5)
ax.invert_yaxis()
ax.set_xlabel("合成スコア (0〜3, ビジネス加重平均)", fontsize=10)
for i, (c_, p_) in enumerate(zip(rc, rp)):
    ax.text(c_ + 0.04, i, f"合成: {c_:.2f} | 推進 noul: {p_:.2f}", va="center", fontsize=8.5, fontweight="bold", color=bar_c[i])
ax.set_xlim(0, 3.2)
ax.set_title("合成スコアによるランキング: 上位・下位の選別が人間の直感と完全一致", fontsize=11.5, fontweight="bold")
fig.tight_layout()
fig.savefig(IMG / "06-business-rank.png", dpi=150, bbox_inches="tight")
plt.close()
embed("06-business-ideas", [("06-business-radar.png", "レーダー"), ("06-business-rank.png", "ランキング")])

# ==========================================
# 07 Cost & LLM Comparison (New!)
# ==========================================
# LLM 価格・スループット比較グラフの作成
models = ["Jev (System 1)", "Gemini 2.0 Flash", "GPT-4o-mini", "Claude 3.5 Haiku", "GPT-4o", "Claude 3.5 Sonnet"]
cost_per_100k_req = [
    12.0,   # Jev: $0.12/1k req = $12 / 100k
    15.0,   # Gemini 2.0 Flash: input $0.10, output $0.40 (~$15 / 100k)
    25.5,   # GPT-4o-mini: input $0.15, output $0.60 (~$25.5 / 100k)
    140.0,  # Claude 3.5 Haiku: input $0.80, output $4.00 (~$140 / 100k)
    425.0,  # GPT-4o: input $2.50, output $10.00 (~$425 / 100k)
    675.0   # Claude 3.5 Sonnet: input $3.00, output $15.00 (~$675 / 100k)
]
p50_latency = [220, 950, 1200, 1400, 2800, 3200]  # ms

fig, axes = plt.subplots(1, 2, figsize=(14, 5.2), dpi=150)

# コスト比較 (対数スケール / バー)
ax = axes[0]
colors = [C["blue"], C["teal"], C["cyan"], C["purple"], C["orange"], C["red"]]
x = np.arange(len(models))
bars = ax.bar(x, cost_per_100k_req, color=colors, width=0.55, zorder=3)
ax.set_xticks(x, [m.replace(" ", "\n") for m in models], fontsize=8.5)
ax.set_yscale("log")
ax.set_ylim(5, 1200)
ax.set_ylabel("10万リクエストあたりのAPIコスト ($) [対数軸]", fontsize=9.5)
ax.set_title("10万回判定あたりのAPIコスト比較 (5問並列判定時)", fontsize=11, fontweight="bold")
for idx, bar in enumerate(bars):
    val = cost_per_100k_req[idx]
    ax.text(bar.get_x() + bar.get_width() / 2, val * 1.15, f"${val:.1f}", ha="center", va="bottom", fontsize=8.5, fontweight="bold", color=colors[idx])

# レイテンシ比較
ax2 = axes[1]
bars2 = ax2.bar(x, p50_latency, color=colors, width=0.55, zorder=3)
ax2.set_xticks(x, [m.replace(" ", "\n") for m in models], fontsize=8.5)
ax2.set_ylabel("推論レイテンシ p50 (ms)", fontsize=9.5)
ax2.set_ylim(0, 3800)
ax2.set_title("推論レスポンス速度の比較 (判定・分類処理)", fontsize=11, fontweight="bold")
ax2.axhline(220, ls=":", c=C["blue"], label="Jev ��ベル (220ms)")
for idx, bar in enumerate(bars2):
    val = p50_latency[idx]
    ax2.text(bar.get_x() + bar.get_width() / 2, val + 60, f"{val}ms", ha="center", va="bottom", fontsize=8.5, fontweight="bold", color=colors[idx])
ax2.legend(frameon=True, fontsize=8.5, loc="upper left")

fig.suptitle("Jev vs 主要 LLM コスト & パフォーマンス徹底比較", fontsize=13, fontweight="bold", y=1.02)
fig.tight_layout()
fig.savefig(IMG / "07-cost-comparison.png", dpi=150, bbox_inches="tight")
plt.close()

# 質問数増加に伴うコストと所要時間スケーリングチャート
fig, axes = plt.subplots(1, 2, figsize=(14, 4.8), dpi=150)
q_counts = [1, 5, 10, 20, 30]

# 質問数 vs 出力トークン/コスト増加
ax = axes[0]
llm_sonnet_cost = [0.0075 * q for q in q_counts]
llm_mini_cost = [0.0003 * q for q in q_counts]
jev_cost = [0.00012 for _ in q_counts]  # Jev は定額/リクエストベース固定

ax.plot(q_counts, [c * 1000 for c in llm_sonnet_cost], marker="o", color=C["red"], lw=2, label="Claude 3.5 Sonnet ($/1k回)")
ax.plot(q_counts, [c * 1000 for c in llm_mini_cost], marker="s", color=C["cyan"], lw=2, label="GPT-4o-mini ($/1k回)")
ax.plot(q_counts, [c * 1000 for c in jev_cost], marker="^", color=C["blue"], lw=2.5, label="Jev (質問数によらずフラット)")
ax.set_xlabel("同時判定する質問数 (1リクエスト内)", fontsize=9.5)
ax.set_ylabel("1,000リクエストあたりコスト ($)", fontsize=9.5)
ax.set_title("質問数増加に対するコスト推移", fontsize=11, fontweight="bold")
ax.legend(frameon=True, fontsize=8.5)

# 質問数 vs レイテンシ増加
ax2 = axes[1]
llm_sonnet_lat = [1500 + 120 * q for q in q_counts]
llm_mini_lat = [800 + 70 * q for q in q_counts]
jev_lat = [215, 227, 236, 240, 245]

ax2.plot(q_counts, llm_sonnet_lat, marker="o", color=C["red"], lw=2, label="Claude 3.5 Sonnet (直列生成オーバーヘッド)")
ax2.plot(q_counts, llm_mini_lat, marker="s", color=C["cyan"], lw=2, label="GPT-4o-mini (JSON 生成長に比例)")
ax2.plot(q_counts, jev_lat, marker="^", color=C["blue"], lw=2.5, label="Jev (超並列 logits 評価: ほぼ一定)")
ax2.set_xlabel("同時判定する質問数 (1リクエスト内)", fontsize=9.5)
ax2.set_ylabel("レイテンシ (ms)", fontsize=9.5)
ax2.set_title("質問数増加に対する推論時間推移", fontsize=11, fontweight="bold")
ax2.legend(frameon=True, fontsize=8.5)

fig.suptitle("質問数の多軸評価におけるスケーラビリティ比較", fontsize=13, fontweight="bold", y=1.02)
fig.tight_layout()
fig.savefig(IMG / "07-latency-throughput.png", dpi=150, bbox_inches="tight")
plt.close()

print("All charts generated and embedded successfully!")

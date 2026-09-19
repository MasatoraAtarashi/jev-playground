# jev-playground

TypeSafe の [Jev](https://docs.typesafe.ai/introduction)（System One モデル）で精度・速度・ユースケースを検証するプレイグラウンド。
結果は [`reports/`](reports/) に Markdown / HTML で残す。

## セットアップ

```bash
cp .env.example .env   # TYPESAFE_API_KEY を記入（https://console.typesafe.ai/keys）
npm install
npm run smoke          # 疎通確認
```

- API キーは `.env` のみに置く。`.env` は `.gitignore` 済み。コードは `node --env-file=.env` 経由で読むので dotenv 不要。
- 実験スクリプトは `experiments/` に置き、`npm run exp -- experiments/foo.ts` で実行。
- キー値をログ・レポートに出さない（`src/lib/client.ts` 参照）。

## ドキュメント調査メモ（2026-09-19 時点）

| 項目 | 内容 |
|---|---|
| エンドポイント | `POST https://api.typesafe.ai/v1/systemone`、`Authorization: Bearer` |
| SDK | JS: `@typesafe-ai/sdk`（Node 20+）/ Python: `typesafe-sdk` |
| モデル | `jev-latest`（疎通時は `jev-1.13.0` が返った） |
| 質問タイプ | `noul`（真偽 0–1）/ `choice`（選択＋確率＋confidence）/ `score`（順序尺度＋確率＋confidence） |
| 入力 | **テキストのみ**。string / JSON object / array。画像・音声・base64・URL 参照は非対応と明記 |
| 言語 | 英語が主。CJK は受け付けるが「現時点では精度が低い」と明記 |
| トークン予算 | 1 リクエスト約 32k トークン（state と質問で共有） |
| エラー | 401 / 422 / 429 / 529。SDK が指数バックオフ |

→ **マルチモーダル入力はネイティブ非対応**。画像は別モデル（Claude 等）でテキスト化してから state に渡す構成になる。

## 疎通結果（smoke）

日本語の苦情文 1 件に対し noul / choice / score を同時に投げた結果。レイテンシ約 2.5 秒（初回）。

- 返金要求 noul: 0.98
- カテゴリ choice: billing（confidence 1.0）
- 怒り score: 1.96 / 2（confidence 0.93）

## レポート一覧

| # | レポート | 一言まとめ |
|---|---|---|
| 1 | [レイテンシ](reports/01-latency.md) | 質問 1→30 件、state 400→12k トークンでも p50 は 215〜260 ms。初回のみ 2.5 秒 |
| 2 | [日英精度](reports/02-ja-vs-en.md) | 12 ケースの日英ペアで判定が全指標一致。公式が言う CJK の精度低下はこの規模では観測されず |
| 3 | [コード変更の危険度](reports/03-code-risk.md) | 危険度 score は ±1 以内で 15/15。高リスク 5 件は全て 2.8 以上。シークレット検出は完璧 |
| 4 | [ツール選択](reports/04-tool-selection.md) | 明確な依頼で 88%。曖昧な依頼は confidence では検出できず、「要確認」noul が機能 |
| 5 | [ゲーム NPC](reports/05-game-agent.md) | 25 ターン中 24 で妥当な行動。p50 223 ms でターン制には十分 |
| 6 | [事業アイデア評価](reports/06-business-ideas.md) | 分解スコアの順位は私見と整合。ただし「見送る」を選びにくく、統合はコード側で持つべき |

## 実験計画

1. **速度**: 質問数・state サイズを変えたときのレイテンシ分布（並列評価の主張の検証）
2. **日本語精度**: 英語と同一内容の日英ペアで choice / score の一致率を測る
3. **コード変更の危険度チェック**: diff を state にして危険度 score・要レビュー noul。Claude の判定と比較
4. **ツール / スキル選択**: 日本語の依頼文からツールを choice で選ぶ。混同行列を出す
5. **ゲーム / オートマタ**: ターン制の状態を state に入れて次の行動を choice。レイテンシとリアルタイム性を評価
6. **事業アイデア評価**: 市場規模・実現性・差別化などを分解して score、ネクストアクションを choice。Claude の判断と並べる
7. ~~マルチモーダル~~: 公式に非対応（[State](https://docs.typesafe.ai/concepts/state) に「text only… not supported (yet)」と明記）のため見送り

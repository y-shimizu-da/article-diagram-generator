# 記事広告 作図生成ツール

記事広告の原稿から、読者の理解を促進するための図（フローチャート、マインドマップ等）を自動生成するWebツールです。

## 機能

1. **記事原稿のアップロード** — テキストファイルのドラッグ&ドロップ、または直接貼り付け
2. **文脈分割** — Claude APIが記事を意味的なまとまりに自動分割
3. **図の種類選択** — フローチャート / マインドマップ / シーケンス図 / タイムライン / 比較図 の5種類
4. **作図生成** — Mermaid.jsで図をレンダリング、SVG/PNGでダウンロード可能

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# .envファイルにAnthropic APIキーを設定
echo "ANTHROPIC_API_KEY=sk-ant-xxxxx" > .env

# サーバー起動
npm start
```

ブラウザで http://localhost:3000 を開いてください。

## 必要要件

- Node.js 18+
- Anthropic APIキー

## 技術スタック

- **バックエンド**: Express + Anthropic SDK (Claude API)
- **フロントエンド**: Vanilla JS + Mermaid.js
- **図のレンダリング**: Mermaid.js (CDN)

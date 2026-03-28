require("dotenv").config();
const express = require("express");
const multer = require("multer");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;
const upload = multer({ dest: "uploads/" });

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const anthropic = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ① 記事原稿のアップロード & ② 文脈分割
app.post("/api/split", upload.single("file"), async (req, res) => {
  try {
    let articleText = req.body.text || "";

    if (req.file) {
      articleText = fs.readFileSync(req.file.path, "utf-8");
      fs.unlinkSync(req.file.path);
    }

    if (!articleText.trim()) {
      return res.status(400).json({ error: "記事テキストが空です" });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `以下の記事広告の原稿を、意味的なまとまり（文脈）ごとに分割してください。

ルール:
- 各セクションには「title」（そのセクションの要約タイトル、15文字以内）と「content」（原文のテキスト）を含めてください
- 記事の論理的な流れや話題の切り替わりを基準に分割してください
- 見出しがある場合はそれを区切りの手がかりにしてください
- 各セクションが独立して理解できる程度のまとまりにしてください
- JSON配列で返してください。JSONのみを返し、他のテキストは含めないでください

出力形式:
[
  {"title": "セクションタイトル", "content": "セクションの本文..."},
  ...
]

記事原稿:
${articleText}`,
        },
      ],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "セクション分割に失敗しました" });
    }

    const sections = JSON.parse(jsonMatch[0]);
    res.json({ sections });
  } catch (err) {
    console.error("Split error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ④ 選択した文脈の作図生成（Mermaid + SVG）
app.post("/api/generate-diagram", async (req, res) => {
  try {
    const { section, diagramType } = req.body;

    if (!section) {
      return res.status(400).json({ error: "セクションが指定されていません" });
    }

    const typePrompts = {
      flowchart: "フローチャート（flowchart TD）",
      mindmap: "マインドマップ（mindmap）",
      sequence: "シーケンス図（sequenceDiagram）",
      timeline: "タイムライン（timeline）",
      comparison: "比較表や構造図（flowchart LR でボックスを並べる形式）",
    };

    const diagramDesc = typePrompts[diagramType] || typePrompts.flowchart;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `以下の記事セクションの内容を読者が視覚的に理解できるよう、Mermaid.js の${diagramDesc}として作図してください。

ルール:
- 記事の内容を正確に反映すること
- 読者の理解を促進する構成にすること
- ノードのテキストは簡潔に（各ノード20文字以内）
- 日本語で記述すること
- Mermaid.jsの正しい構文で出力すること
- コードブロック（\`\`\`mermaid ... \`\`\`）の中身だけを返してください
- ノードIDには日本語やスペースを使わず、英数字のみを使ってください
- ノードのラベルは["テキスト"] の形式で日本語を囲んでください
- subgraphのタイトルも日本語OKです

セクションタイトル: ${section.title}
セクション内容:
${section.content}`,
        },
      ],
    });

    let mermaidCode = response.content[0].text;
    // Remove markdown code fences if present
    mermaidCode = mermaidCode
      .replace(/```mermaid\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Also generate a text summary for the diagram
    const summaryResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `以下の記事セクションの内容を、図の説明文として1〜2文で要約してください。

セクションタイトル: ${section.title}
セクション内容:
${section.content}`,
        },
      ],
    });

    const summary = summaryResponse.content[0].text.trim();

    res.json({ mermaidCode, summary });
  } catch (err) {
    console.error("Diagram generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✔ サーバー起動: http://localhost:${PORT}`);
});

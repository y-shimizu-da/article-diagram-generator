document.addEventListener("DOMContentLoaded", () => {
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: '"Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
  });

  // DOM Elements
  const uploadArea = document.getElementById("uploadArea");
  const fileInput = document.getElementById("fileInput");
  const articleText = document.getElementById("articleText");
  const splitBtn = document.getElementById("splitBtn");
  const sectionsList = document.getElementById("sectionsList");
  const generateBtn = document.getElementById("generateBtn");
  const diagramsOutput = document.getElementById("diagramsOutput");
  const backBtn = document.getElementById("backBtn");
  const downloadAllBtn = document.getElementById("downloadAllBtn");
  const loading = document.getElementById("loading");
  const loadingText = document.getElementById("loadingText");

  const steps = {
    step1: document.getElementById("step1"),
    step2: document.getElementById("step2"),
    step3: document.getElementById("step3"),
  };

  let sections = [];
  let generatedDiagrams = [];

  // --- Step 1: File Upload ---

  uploadArea.addEventListener("click", () => fileInput.click());

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) readFile(fileInput.files[0]);
  });

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      articleText.value = e.target.result;
      updateSplitBtn();
    };
    reader.readAsText(file);
  }

  articleText.addEventListener("input", updateSplitBtn);

  function updateSplitBtn() {
    splitBtn.disabled = !articleText.value.trim();
  }

  // --- Split Article ---

  splitBtn.addEventListener("click", async () => {
    const text = articleText.value.trim();
    if (!text) return;

    showLoading("記事を文脈ごとに分析中...");

    try {
      const res = await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "分析に失敗しました");
      }

      const data = await res.json();
      sections = data.sections;
      renderSections();
      showStep("step2");
    } catch (err) {
      showError(steps.step1.querySelector(".step-content"), err.message);
    } finally {
      hideLoading();
    }
  });

  // --- Step 2: Section Selection ---

  function renderSections() {
    sectionsList.innerHTML = "";
    sections.forEach((sec, i) => {
      const item = document.createElement("div");
      item.className = "section-item";
      item.innerHTML = `
        <input type="checkbox" id="sec-${i}" data-index="${i}">
        <div class="section-info">
          <div class="section-title">${escapeHtml(sec.title)}</div>
          <div class="section-preview">${escapeHtml(sec.content)}</div>
        </div>
      `;
      item.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") {
          const cb = item.querySelector("input");
          cb.checked = !cb.checked;
        }
        item.classList.toggle("selected", item.querySelector("input").checked);
        updateGenerateBtn();
      });
      sectionsList.appendChild(item);
    });
    updateGenerateBtn();
  }

  function updateGenerateBtn() {
    const checked = sectionsList.querySelectorAll("input:checked");
    generateBtn.disabled = checked.length === 0;
  }

  // --- Generate Diagrams ---

  generateBtn.addEventListener("click", async () => {
    const checkedInputs = sectionsList.querySelectorAll("input:checked");
    const selectedIndices = Array.from(checkedInputs).map((cb) =>
      parseInt(cb.dataset.index)
    );
    const diagramType = document.querySelector(
      'input[name="diagramType"]:checked'
    ).value;

    if (selectedIndices.length === 0) return;

    showLoading("図を生成中...");
    generatedDiagrams = [];
    diagramsOutput.innerHTML = "";

    try {
      for (let idx = 0; idx < selectedIndices.length; idx++) {
        const sIdx = selectedIndices[idx];
        const section = sections[sIdx];
        loadingText.textContent = `図を生成中... (${idx + 1}/${selectedIndices.length}) ${section.title}`;

        const res = await fetch("/api/generate-diagram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section, diagramType }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `「${section.title}」の図生成に失敗`);
        }

        const data = await res.json();
        generatedDiagrams.push({
          title: section.title,
          mermaidCode: data.mermaidCode,
          summary: data.summary,
        });
      }

      await renderDiagrams();
      showStep("step3");
    } catch (err) {
      showError(steps.step2.querySelector(".step-content"), err.message);
    } finally {
      hideLoading();
    }
  });

  async function renderDiagrams() {
    diagramsOutput.innerHTML = "";

    for (let i = 0; i < generatedDiagrams.length; i++) {
      const d = generatedDiagrams[i];
      const card = document.createElement("div");
      card.className = "diagram-card";
      const diagramId = `mermaid-${i}-${Date.now()}`;

      card.innerHTML = `
        <div class="diagram-card-header">
          <h3>${escapeHtml(d.title)}</h3>
          <div class="diagram-actions">
            <button class="btn-sm" onclick="copySvg('${diagramId}')">SVGコピー</button>
            <button class="btn-sm" onclick="downloadSvg('${diagramId}', '${escapeHtml(d.title)}')">SVGダウンロード</button>
            <button class="btn-sm" onclick="downloadPng('${diagramId}', '${escapeHtml(d.title)}')">PNGダウンロード</button>
          </div>
        </div>
        <div class="diagram-card-body">
          <div class="mermaid" id="${diagramId}">${escapeHtml(d.mermaidCode)}</div>
        </div>
        <div class="diagram-summary">${escapeHtml(d.summary)}</div>
      `;
      diagramsOutput.appendChild(card);

      // Render mermaid
      try {
        const { svg } = await mermaid.render(diagramId + "-svg", d.mermaidCode);
        card.querySelector(".mermaid").innerHTML = svg;
      } catch (err) {
        card.querySelector(".mermaid").innerHTML = `
          <div class="error-msg">
            図のレンダリングに失敗しました。Mermaidコード:<br>
            <pre style="margin-top:8px;font-size:0.8rem;white-space:pre-wrap">${escapeHtml(d.mermaidCode)}</pre>
          </div>
        `;
      }
    }
  }

  // --- Navigation ---

  backBtn.addEventListener("click", () => showStep("step2"));

  downloadAllBtn.addEventListener("click", () => {
    document.querySelectorAll(".diagram-card-body").forEach((body, i) => {
      const svg = body.querySelector("svg");
      if (svg) {
        const title = generatedDiagrams[i]?.title || `diagram-${i}`;
        downloadSvgElement(svg, title);
      }
    });
  });

  // --- Helper Functions ---

  function showStep(stepId) {
    Object.values(steps).forEach((s) => s.classList.remove("active"));
    steps[stepId].classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showLoading(msg) {
    loadingText.textContent = msg;
    loading.classList.remove("hidden");
  }

  function hideLoading() {
    loading.classList.add("hidden");
  }

  function showError(container, msg) {
    const existing = container.querySelector(".error-msg");
    if (existing) existing.remove();
    const el = document.createElement("div");
    el.className = "error-msg";
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Global Download/Copy Functions ---

  window.copySvg = function (diagramId) {
    const container = document.getElementById(diagramId);
    const svg = container?.querySelector("svg") || container;
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      navigator.clipboard.writeText(svgData).then(() => {
        alert("SVGをクリップボードにコピーしました");
      });
    }
  };

  window.downloadSvg = function (diagramId, title) {
    const container = document.getElementById(diagramId);
    const svg = container?.querySelector("svg") || container;
    if (svg) downloadSvgElement(svg, title);
  };

  window.downloadPng = function (diagramId, title) {
    const container = document.getElementById(diagramId);
    const svg = container?.querySelector("svg") || container;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${title}.png`;
      a.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  function downloadSvgElement(svg, title) {
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }
});

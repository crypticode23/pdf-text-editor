import { useState, useRef, useEffect, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// PDF.js worker — use CDN for reliable Vite compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

/* ── Constants ──────────────────────────────────────── */

const FONT_MAP = {
  Helvetica: StandardFonts.Helvetica,
  "Helvetica Bold": StandardFonts.HelveticaBold,
  "Times Roman": StandardFonts.TimesRoman,
  "Times Bold": StandardFonts.TimesRomanBold,
  Courier: StandardFonts.Courier,
  "Courier Bold": StandardFonts.CourierBold,
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

/* ── Styles ─────────────────────────────────────────── */

const cssVars = {
  "--bg": "#FAFAF8",
  "--surface": "#FFFFFF",
  "--surface-hover": "#F3F3F0",
  "--border": "#E0DED8",
  "--text-primary": "#1A1A18",
  "--text-secondary": "#5A5A54",
  "--text-muted": "#9E9E94",
  "--accent": "#2E6FD0",
  "--accent-hover": "#2459AB",
  "--danger": "#CC3D3D",
  "--font-body": "'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif",
  "--font-mono": "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 5,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1.5px solid var(--border)",
  borderRadius: 6,
  fontSize: 14,
  background: "var(--bg)",
  color: "var(--text-primary)",
  outline: "none",
  marginBottom: 16,
  boxSizing: "border-box",
  transition: "border-color 0.15s ease",
};

const btnPrimary = {
  flex: 1,
  padding: "10px 16px",
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondary = {
  flex: 1,
  padding: "10px 16px",
  background: "var(--surface-hover)",
  color: "var(--text-secondary)",
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

/* ── FileUpload ─────────────────────────────────────── */

function FileUpload({ onFileSelect, loading }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === "application/pdf") onFileSelect(file);
    },
    [onFileSelect]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 12,
        padding: "64px 32px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.25s ease",
        background: dragOver ? "var(--surface-hover)" : "transparent",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) onFileSelect(file);
        }}
      />
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>📄</div>
      <p
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 8px",
        }}
      >
        {loading ? "Loading PDF…" : "Drop PDF here or click to browse"}
      </p>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        Supports any standard PDF file
      </p>
    </div>
  );
}

/* ── PDFPageCanvas ──────────────────────────────────── */

function PDFPageCanvas({
  page,
  pageNum,
  scale,
  onTextItemClick,
  selectedItemIndex,
}) {
  const canvasRef = useRef(null);
  const [textItems, setTextItems] = useState([]);

  useEffect(() => {
    if (!page) return;
    const vp = page.getViewport({ scale });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = vp.width;
    canvas.height = vp.height;

    page.render({ canvasContext: ctx, viewport: vp }).promise.then(() => {
      page.getTextContent().then((content) => {
        const items = content.items
          .filter((item) => item.str.trim().length > 0)
          .map((item, idx) => {
            const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
            return {
              index: idx,
              str: item.str,
              x: tx[4],
              y: tx[5] - item.height,
              width: item.width * scale,
              height: item.height * scale,
              fontName: item.fontName || "Helvetica",
              originalTransform: item.transform,
            };
          });
        setTextItems(items);
      });
    });
  }, [page, scale]);

  return (
    <div style={{ position: "relative", marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginBottom: 6,
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.05em",
        }}
      >
        PAGE {pageNum}
      </div>
      <div
        style={{
          position: "relative",
          display: "inline-block",
          boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block" }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          {textItems.map((item) => (
            <div
              key={item.index}
              onClick={() => onTextItemClick(pageNum, item)}
              title={item.str}
              style={{
                position: "absolute",
                left: item.x,
                top: item.y,
                width: Math.max(item.width, 20),
                height: Math.max(item.height, 12),
                cursor: "pointer",
                background:
                  selectedItemIndex === item.index
                    ? "rgba(46, 119, 208, 0.25)"
                    : "transparent",
                border:
                  selectedItemIndex === item.index
                    ? "1.5px solid rgba(46, 119, 208, 0.7)"
                    : "1.5px solid transparent",
                borderRadius: 2,
                transition: "all 0.15s ease",
                boxSizing: "border-box",
              }}
              onMouseEnter={(e) => {
                if (selectedItemIndex !== item.index) {
                  e.currentTarget.style.background = "rgba(46, 119, 208, 0.10)";
                  e.currentTarget.style.borderColor = "rgba(46, 119, 208, 0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedItemIndex !== item.index) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── EditPanel ──────────────────────────────────────── */

function EditPanel({ selection, onSave, onCancel }) {
  const [text, setText] = useState(selection?.str || "");
  const [font, setFont] = useState("Helvetica");
  const [color, setColor] = useState("#000000");

  useEffect(() => {
    setText(selection?.str || "");
    setColor("#000000");
    setFont("Helvetica");
  }, [selection]);

  if (!selection)
    return (
      <div
        style={{
          padding: 32,
          color: "var(--text-muted)",
          textAlign: "center",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>🖱️</div>
        Click on any text element in the PDF preview to select and edit it.
      </div>
    );

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          marginBottom: 16,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Editing — Page {selection.pageNum}
      </div>

      <label style={labelStyle}>Original</label>
      <div
        style={{
          padding: "10px 12px",
          background: "var(--surface-hover)",
          borderRadius: 6,
          fontSize: 13,
          color: "var(--text-secondary)",
          marginBottom: 16,
          fontFamily: "var(--font-mono)",
          wordBreak: "break-all",
          maxHeight: 80,
          overflow: "auto",
        }}
      >
        {selection.str}
      </div>

      <label style={labelStyle}>New Text</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={{
          ...inputStyle,
          resize: "vertical",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
        }}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Font</label>
          <select
            value={font}
            onChange={(e) => setFont(e.target.value)}
            style={inputStyle}
          >
            {Object.keys(FONT_MAP).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "0 0 80px" }}>
          <label style={labelStyle}>Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ ...inputStyle, padding: 4, height: 38, cursor: "pointer" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => onSave({ ...selection, newText: text, font, color })}
          style={btnPrimary}
        >
          Apply Edit
        </button>
        <button onClick={onCancel} style={btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── EditsLog ───────────────────────────────────────── */

function EditsLog({ edits, onRemove }) {
  if (edits.length === 0) return null;
  return (
    <div style={{ padding: "12px 20px 20px" }}>
      <div
        style={{
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          marginBottom: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Pending Edits ({edits.length})
      </div>
      {edits.map((edit, i) => (
        <div
          key={i}
          style={{
            padding: "8px 10px",
            background: "var(--surface-hover)",
            borderRadius: 6,
            marginBottom: 6,
            fontSize: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: "var(--text-muted)" }}>P{edit.pageNum}</span>{" "}
            <span
              style={{
                textDecoration: "line-through",
                color: "var(--text-muted)",
              }}
            >
              {edit.str.slice(0, 20)}
            </span>
            {" → "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
              {edit.newText.slice(0, 20)}
            </span>
          </div>
          <button
            onClick={() => onRemove(i)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 14,
              padding: "2px 4px",
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Main App ───────────────────────────────────────── */

export default function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selection, setSelection] = useState(null);
  const [edits, setEdits] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [scale] = useState(1.3);
  const fileBytes = useRef(null);

  const loadPDF = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setPages([]);
    setEdits([]);
    setSelection(null);
    try {
      const arrayBuf = await file.arrayBuffer();
      fileBytes.current = new Uint8Array(arrayBuf);
      const doc = await pdfjsLib.getDocument({ data: arrayBuf.slice(0) })
        .promise;
      setPdfDoc(doc);
      setPdfFile(file);
      const pagePromises = [];
      for (let i = 1; i <= doc.numPages; i++) {
        pagePromises.push(doc.getPage(i));
      }
      const loadedPages = await Promise.all(pagePromises);
      setPages(loadedPages);
    } catch (e) {
      console.error(e);
      setError("Failed to load PDF. The file may be encrypted or corrupted.");
    }
    setLoading(false);
  }, []);

  const handleTextItemClick = useCallback((pageNum, item) => {
    setSelection({ pageNum, ...item });
  }, []);

  const handleSaveEdit = useCallback((editData) => {
    setEdits((prev) => [...prev, editData]);
    setSelection(null);
  }, []);

  const handleRemoveEdit = useCallback((idx) => {
    setEdits((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleExport = useCallback(async () => {
    if (!fileBytes.current || edits.length === 0) return;
    setExporting(true);
    try {
      const pdfDocLib = await PDFDocument.load(fileBytes.current, {
        ignoreEncryption: true,
      });
      const embeddedFonts = {};

      for (const edit of edits) {
        const fontKey = FONT_MAP[edit.font] || StandardFonts.Helvetica;
        if (!embeddedFonts[fontKey]) {
          embeddedFonts[fontKey] = await pdfDocLib.embedFont(fontKey);
        }
        const pdfFont = embeddedFonts[fontKey];
        const page = pdfDocLib.getPages()[edit.pageNum - 1];
        if (!page) continue;

        const transform = edit.originalTransform;
        const fontSize = Math.abs(transform[3]) || 12;
        const x = transform[4];
        const y = transform[5];

        // Cover old text with white rect
        const textWidth = pdfFont.widthOfTextAtSize(edit.str, fontSize) + 4;
        page.drawRectangle({
          x: x - 1,
          y: y - 2,
          width: Math.max(textWidth, edit.width / scale + 8),
          height: fontSize + 4,
          color: rgb(1, 1, 1),
        });

        // Draw new text
        const c = hexToRgb(edit.color);
        page.drawText(edit.newText, {
          x,
          y,
          size: fontSize,
          font: pdfFont,
          color: rgb(c.r, c.g, c.b),
        });
      }

      const modifiedBytes = await pdfDocLib.save();
      const blob = new Blob([modifiedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        (pdfFile?.name || "document").replace(".pdf", "") + "_edited.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setError("Export failed: " + e.message);
    }
    setExporting(false);
  }, [edits, pdfFile, scale]);

  const handleClear = useCallback(() => {
    setPdfFile(null);
    setPdfDoc(null);
    setPages([]);
    setEdits([]);
    setSelection(null);
    setError(null);
    fileBytes.current = null;
  }, []);

  return (
    <div
      style={{
        ...cssVars,
        fontFamily: "var(--font-body)",
        background: "var(--bg)",
        color: "var(--text-primary)",
        minHeight: "100vh",
        lineHeight: 1.5,
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            T
          </div>
          <span
            style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}
          >
            PDF Text Editor
          </span>
          {pdfFile && (
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                marginLeft: 4,
              }}
            >
              — {pdfFile.name}
            </span>
          )}
        </div>
        {pdfFile && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleExport}
              disabled={edits.length === 0 || exporting}
              style={{
                ...btnPrimary,
                flex: "none",
                padding: "8px 18px",
                opacity: edits.length === 0 ? 0.4 : 1,
                cursor: edits.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {exporting ? "Exporting…" : `Download (${edits.length})`}
            </button>
            <button
              onClick={handleClear}
              style={{
                ...btnSecondary,
                flex: "none",
                padding: "8px 14px",
                color: "var(--danger)",
                borderColor: "var(--danger)",
              }}
            >
              Clear
            </button>
          </div>
        )}
      </header>

      {/* Error */}
      {error && (
        <div
          style={{
            margin: "16px 24px 0",
            padding: "12px 16px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            color: "#991B1B",
            fontSize: 13,
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              float: "right",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#991B1B",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Content */}
      {!pdfFile ? (
        <div style={{ padding: "80px 24px" }}>
          <FileUpload onFileSelect={loadPDF} loading={loading} />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            height: "calc(100vh - 57px)",
            overflow: "hidden",
          }}
        >
          {/* PDF Preview */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 24,
              background: "#EDEDEB",
            }}
          >
            {loading && (
              <div
                style={{
                  textAlign: "center",
                  padding: 40,
                  color: "var(--text-muted)",
                }}
              >
                Loading pages…
              </div>
            )}
            {pages.map((page, i) => (
              <PDFPageCanvas
                key={i}
                page={page}
                pageNum={i + 1}
                scale={scale}
                onTextItemClick={handleTextItemClick}
                selectedItemIndex={
                  selection?.pageNum === i + 1 ? selection.index : null
                }
              />
            ))}
          </div>

          {/* Sidebar */}
          <div
            style={{
              width: 320,
              minWidth: 320,
              borderLeft: "1px solid var(--border)",
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
            }}
          >
            <EditPanel
              selection={selection}
              onSave={handleSaveEdit}
              onCancel={() => setSelection(null)}
            />
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <EditsLog edits={edits} onRemove={handleRemoveEdit} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

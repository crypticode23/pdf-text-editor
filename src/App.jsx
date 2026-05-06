import { useState, useRef, useEffect, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/* ── Font mapping ───────────────────────────────────── */

const STANDARD_FONTS = [
  { label: "Helvetica", value: StandardFonts.Helvetica },
  { label: "Helvetica Bold", value: StandardFonts.HelveticaBold },
  { label: "Helvetica Italic", value: StandardFonts.HelveticaOblique },
  { label: "Helvetica Bold Italic", value: StandardFonts.HelveticaBoldOblique },
  { label: "Times Roman", value: StandardFonts.TimesRoman },
  { label: "Times Bold", value: StandardFonts.TimesRomanBold },
  { label: "Times Italic", value: StandardFonts.TimesRomanItalic },
  { label: "Times Bold Italic", value: StandardFonts.TimesRomanBoldItalic },
  { label: "Courier", value: StandardFonts.Courier },
  { label: "Courier Bold", value: StandardFonts.CourierBold },
  { label: "Courier Italic", value: StandardFonts.CourierOblique },
  { label: "Courier Bold Italic", value: StandardFonts.CourierBoldOblique },
];

function guessStandardFont(pdfFontName) {
  if (!pdfFontName) return StandardFonts.Helvetica;
  const n = pdfFontName.toLowerCase();
  const isBold = n.includes("bold") || n.includes("heavy") || n.includes("black");
  const isItalic = n.includes("italic") || n.includes("oblique");
  const isTimes = n.includes("times") || n.includes("serif");
  const isCourier = n.includes("courier") || n.includes("mono") || n.includes("consolas");

  if (isCourier) {
    if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
    if (isBold) return StandardFonts.CourierBold;
    if (isItalic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (isTimes) {
    if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
    if (isBold) return StandardFonts.TimesRomanBold;
    if (isItalic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
  if (isBold) return StandardFonts.HelveticaBold;
  if (isItalic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

/* ── Apply edits to PDF bytes ───────────────────────── */

async function applyEditsToPdfBytes(originalBytes, edits) {
  const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const embeddedFonts = {};

  for (const edit of edits) {
    const fontEnum = edit.fontEnum || StandardFonts.Helvetica;
    if (!embeddedFonts[fontEnum]) {
      embeddedFonts[fontEnum] = await pdfDoc.embedFont(fontEnum);
    }
    const pdfFont = embeddedFonts[fontEnum];
    const page = pdfDoc.getPages()[edit.pageNum - 1];
    if (!page) continue;

    const t = edit.originalTransform;
    const fontSize = Math.abs(t[3]) || 12;
    const x = t[4];
    const y = t[5];

    let oldWidth;
    try {
      oldWidth = pdfFont.widthOfTextAtSize(edit.originalText, fontSize);
    } catch {
      oldWidth = edit.originalText.length * fontSize * 0.5;
    }

    // White rect to cover old text
    page.drawRectangle({
      x: x - 0.5,
      y: y - fontSize * 0.25,
      width: oldWidth + 2,
      height: fontSize * 1.3,
      color: rgb(1, 1, 1),
    });

    const c = hexToRgb(edit.color);
    page.drawText(edit.newText, {
      x,
      y,
      size: fontSize,
      font: pdfFont,
      color: rgb(c.r, c.g, c.b),
    });
  }

  return await pdfDoc.save();
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
  "--danger": "#CC3D3D",
  "--font-body": "'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif",
  "--font-mono": "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
};

const labelStyle = {
  display: "block", fontSize: 11, fontWeight: 600,
  color: "var(--text-secondary)", marginBottom: 5,
  letterSpacing: "0.03em", textTransform: "uppercase",
};
const inputStyle = {
  width: "100%", padding: "8px 10px",
  border: "1.5px solid var(--border)", borderRadius: 6,
  fontSize: 14, background: "var(--bg)", color: "var(--text-primary)",
  outline: "none", marginBottom: 16, boxSizing: "border-box",
};
const btnPrimary = {
  flex: 1, padding: "10px 16px", background: "var(--accent)",
  color: "#fff", border: "none", borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnSecondary = {
  flex: 1, padding: "10px 16px", background: "var(--surface-hover)",
  color: "var(--text-secondary)", border: "1.5px solid var(--border)",
  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
};

/* ── FileUpload ─────────────────────────────────────── */

function FileUpload({ onFileSelect, loading }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file?.type === "application/pdf") onFileSelect(file);
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 12, padding: "64px 32px", textAlign: "center",
        cursor: "pointer", transition: "all 0.25s ease",
        background: dragOver ? "var(--surface-hover)" : "transparent",
        maxWidth: 560, margin: "0 auto",
      }}
    >
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: "none" }}
        onChange={(e) => { if (e.target.files[0]) onFileSelect(e.target.files[0]); }}
      />
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>📄</div>
      <p style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>
        {loading ? "Loading PDF…" : "Drop PDF here or click to browse"}
      </p>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        Supports any standard PDF file
      </p>
    </div>
  );
}

/* ── PDFPageCanvas ──────────────────────────────────── */

function PDFPageCanvas({ page, pageNum, scale, onTextItemClick, selectedItemIndex, edits }) {
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
              fontName: item.fontName || "",
              originalTransform: item.transform,
            };
          });
        setTextItems(items);
      });
    });
  }, [page, scale]);

  const editedIndices = new Set(
    edits.filter((e) => e.pageNum === pageNum).map((e) => e.itemIndex)
  );

  return (
    <div style={{ position: "relative", marginBottom: 16 }}>
      <div style={{
        fontSize: 11, color: "var(--text-muted)", marginBottom: 6,
        fontFamily: "var(--font-mono)", letterSpacing: "0.05em",
      }}>
        PAGE {pageNum}
      </div>
      <div style={{
        position: "relative", display: "inline-block",
        boxShadow: "0 2px 16px rgba(0,0,0,0.10)", borderRadius: 4, overflow: "hidden",
      }}>
        <canvas ref={canvasRef} style={{ display: "block" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
          {textItems.map((item) => {
            const isEdited = editedIndices.has(item.index);
            const isSelected = selectedItemIndex === item.index;
            return (
              <div
                key={item.index}
                onClick={() => onTextItemClick(pageNum, item)}
                title={item.str}
                style={{
                  position: "absolute",
                  left: item.x, top: item.y,
                  width: Math.max(item.width, 20),
                  height: Math.max(item.height, 12),
                  cursor: "pointer",
                  background: isSelected
                    ? "rgba(46, 119, 208, 0.25)"
                    : isEdited ? "rgba(34, 197, 94, 0.15)" : "transparent",
                  border: isSelected
                    ? "1.5px solid rgba(46, 119, 208, 0.7)"
                    : isEdited ? "1.5px solid rgba(34, 197, 94, 0.5)" : "1.5px solid transparent",
                  borderRadius: 2, transition: "all 0.15s ease", boxSizing: "border-box",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "rgba(46, 119, 208, 0.10)";
                    e.currentTarget.style.borderColor = "rgba(46, 119, 208, 0.3)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEdited ? "rgba(34, 197, 94, 0.15)" : "transparent";
                    e.currentTarget.style.borderColor = isEdited ? "rgba(34, 197, 94, 0.5)" : "transparent";
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── EditPanel ──────────────────────────────────────── */

function EditPanel({ selection, onSave, onCancel, existingEdit }) {
  const [text, setText] = useState("");
  const [fontEnum, setFontEnum] = useState(StandardFonts.Helvetica);
  const [color, setColor] = useState("#000000");

  useEffect(() => {
    if (existingEdit) {
      setText(existingEdit.newText);
      setFontEnum(existingEdit.fontEnum);
      setColor(existingEdit.color);
    } else if (selection) {
      setText(selection.str);
      setFontEnum(guessStandardFont(selection.fontName));
      setColor("#000000");
    }
  }, [selection, existingEdit]);

  if (!selection) return (
    <div style={{ padding: 32, color: "var(--text-muted)", textAlign: "center", fontSize: 14, lineHeight: 1.6 }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>🖱️</div>
      Click on any text element in the PDF preview to select and edit it.
    </div>
  );

  return (
    <div style={{ padding: 20 }}>
      <div style={{
        fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)",
        marginBottom: 16, letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        Editing — Page {selection.pageNum}{" "}
        {existingEdit && <span style={{ color: "var(--accent)" }}>(re-editing)</span>}
      </div>

      <label style={labelStyle}>Original Text</label>
      <div style={{
        padding: "10px 12px", background: "var(--surface-hover)", borderRadius: 6,
        fontSize: 13, color: "var(--text-secondary)", marginBottom: 16,
        fontFamily: "var(--font-mono)", wordBreak: "break-all", maxHeight: 80, overflow: "auto",
      }}>
        {selection.str}
      </div>

      <label style={labelStyle}>
        Detected Font: <span style={{ color: "var(--accent)", fontWeight: 400 }}>{selection.fontName || "unknown"}</span>
      </label>
      <div style={{ marginBottom: 8 }} />

      <label style={labelStyle}>New Text</label>
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={3}
        style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 13 }}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Output Font</label>
          <select value={fontEnum} onChange={(e) => setFontEnum(e.target.value)} style={inputStyle}>
            {STANDARD_FONTS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: "0 0 80px" }}>
          <label style={labelStyle}>Color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            style={{ ...inputStyle, padding: 4, height: 38, cursor: "pointer" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onSave({
          pageNum: selection.pageNum,
          itemIndex: selection.index,
          originalText: selection.str,
          newText: text,
          fontEnum,
          color,
          fontName: selection.fontName,
          originalTransform: selection.originalTransform,
          width: selection.width,
          height: selection.height,
        })} style={btnPrimary}>
          {existingEdit ? "Update Edit" : "Apply Edit"}
        </button>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

/* ── EditsLog ───────────────────────────────────────── */

function EditsLog({ edits, onRemove, onClickEdit }) {
  if (edits.length === 0) return null;
  return (
    <div style={{ padding: "12px 20px 20px" }}>
      <div style={{
        fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)",
        marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        Pending Edits ({edits.length})
      </div>
      {edits.map((edit, i) => (
        <div key={i} onClick={() => onClickEdit(i)} style={{
          padding: "8px 10px", background: "var(--surface-hover)", borderRadius: 6,
          marginBottom: 6, fontSize: 12, display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: 8, cursor: "pointer",
          border: "1px solid transparent", transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = "transparent"}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: "var(--text-muted)" }}>P{edit.pageNum}</span>{" "}
            <span style={{ textDecoration: "line-through", color: "var(--text-muted)" }}>
              {edit.originalText.slice(0, 18)}
            </span>
            {" → "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
              {edit.newText.slice(0, 18)}
            </span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onRemove(i); }} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: 14, padding: "2px 4px",
          }}>✕</button>
        </div>
      ))}
    </div>
  );
}

/* ── Main App ───────────────────────────────────────── */

export default function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selection, setSelection] = useState(null);
  const [edits, setEdits] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const scale = 1.3;

  const originalBytes = useRef(null);

  const loadPagesFromBytes = useCallback(async (bytes) => {
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const ps = [];
    for (let i = 1; i <= doc.numPages; i++) {
      ps.push(await doc.getPage(i));
    }
    return ps;
  }, []);

  const loadPDF = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setPages([]); setEdits([]); setSelection(null);
    setPreviewMode(false); setEditingIndex(null);
    try {
      const buf = await file.arrayBuffer();
      originalBytes.current = new Uint8Array(buf);
      const ps = await loadPagesFromBytes(originalBytes.current);
      setPages(ps);
      setPdfFile(file);
    } catch (e) {
      console.error(e);
      setError("Failed to load PDF. Error: " + e.message);
    }
    setLoading(false);
  }, [loadPagesFromBytes]);

  const refreshPreview = useCallback(async (currentEdits) => {
    if (!originalBytes.current) return;
    if (currentEdits.length === 0) {
      setPreviewMode(false);
      const ps = await loadPagesFromBytes(originalBytes.current);
      setPages(ps);
      return;
    }
    try {
      const edited = await applyEditsToPdfBytes(originalBytes.current, currentEdits);
      setPreviewMode(true);
      const ps = await loadPagesFromBytes(edited);
      setPages(ps);
    } catch (e) {
      console.error("Preview refresh failed:", e);
    }
  }, [loadPagesFromBytes]);

  const handleTextItemClick = useCallback((pageNum, item) => {
    setSelection({ pageNum, ...item });
    const existIdx = edits.findIndex((e) => e.pageNum === pageNum && e.itemIndex === item.index);
    setEditingIndex(existIdx >= 0 ? existIdx : null);
  }, [edits]);

  const handleSaveEdit = useCallback(async (editData) => {
    let newEdits;
    if (editingIndex !== null) {
      newEdits = edits.map((e, i) => (i === editingIndex ? editData : e));
    } else {
      newEdits = [
        ...edits.filter((e) => !(e.pageNum === editData.pageNum && e.itemIndex === editData.itemIndex)),
        editData,
      ];
    }
    setEdits(newEdits);
    setSelection(null);
    setEditingIndex(null);
    await refreshPreview(newEdits);
  }, [edits, editingIndex, refreshPreview]);

  const handleRemoveEdit = useCallback(async (idx) => {
    const newEdits = edits.filter((_, i) => i !== idx);
    setEdits(newEdits);
    setEditingIndex(null);
    setSelection(null);
    await refreshPreview(newEdits);
  }, [edits, refreshPreview]);

  const handleClickEditLog = useCallback((idx) => {
    const edit = edits[idx];
    setSelection({
      pageNum: edit.pageNum, index: edit.itemIndex,
      str: edit.originalText, fontName: edit.fontName,
      originalTransform: edit.originalTransform,
      width: edit.width, height: edit.height,
    });
    setEditingIndex(idx);
  }, [edits]);

  const handleExport = useCallback(async () => {
    if (!originalBytes.current || edits.length === 0) return;
    setExporting(true);
    try {
      const finalBytes = await applyEditsToPdfBytes(originalBytes.current, edits);
      const blob = new Blob([finalBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (pdfFile?.name || "document").replace(/\.pdf$/i, "") + "_edited.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setError("Export failed: " + e.message);
    }
    setExporting(false);
  }, [edits, pdfFile]);

  const handleTogglePreview = useCallback(async () => {
    if (previewMode) {
      const ps = await loadPagesFromBytes(originalBytes.current);
      setPages(ps);
      setPreviewMode(false);
    } else if (edits.length > 0) {
      await refreshPreview(edits);
    }
  }, [previewMode, edits, loadPagesFromBytes, refreshPreview]);

  const handleClear = useCallback(() => {
    setPdfFile(null); setPages([]); setEdits([]);
    setSelection(null); setError(null); setPreviewMode(false);
    setEditingIndex(null); originalBytes.current = null;
  }, []);

  const existingEdit = editingIndex !== null ? edits[editingIndex] : null;

  return (
    <div style={{
      ...cssVars, fontFamily: "var(--font-body)",
      background: "var(--bg)", color: "var(--text-primary)",
      minHeight: "100vh", lineHeight: 1.5,
    }}>
      <header style={{
        borderBottom: "1px solid var(--border)", padding: "14px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "var(--surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#fff", fontWeight: 700,
          }}>T</div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>
            PDF Text Editor
          </span>
          {pdfFile && (
            <span style={{
              fontSize: 12, color: "var(--text-muted)",
              fontFamily: "var(--font-mono)", marginLeft: 4,
            }}>— {pdfFile.name}</span>
          )}
        </div>
        {pdfFile && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {edits.length > 0 && (
              <button onClick={handleTogglePreview} style={{
                ...btnSecondary, flex: "none", padding: "8px 14px", fontSize: 12,
              }}>
                {previewMode ? "Show Original" : "Show Preview"}
              </button>
            )}
            {previewMode && (
              <span style={{
                fontSize: 11, color: "#22c55e", fontWeight: 600,
                fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
              }}>PREVIEW</span>
            )}
            <button onClick={handleExport}
              disabled={edits.length === 0 || exporting}
              style={{
                ...btnPrimary, flex: "none", padding: "8px 18px",
                opacity: edits.length === 0 ? 0.4 : 1,
                cursor: edits.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {exporting ? "Exporting…" : `Download (${edits.length})`}
            </button>
            <button onClick={handleClear} style={{
              ...btnSecondary, flex: "none", padding: "8px 14px",
              color: "var(--danger)", borderColor: "var(--danger)",
            }}>Clear</button>
          </div>
        )}
      </header>

      {error && (
        <div style={{
          margin: "16px 24px 0", padding: "12px 16px",
          background: "#FEF2F2", border: "1px solid #FCA5A5",
          borderRadius: 8, color: "#991B1B", fontSize: 13,
        }}>
          {error}
          <button onClick={() => setError(null)} style={{
            float: "right", background: "none", border: "none",
            cursor: "pointer", color: "#991B1B", fontWeight: 700,
          }}>✕</button>
        </div>
      )}

      {!pdfFile ? (
        <div style={{ padding: "80px 24px" }}>
          <FileUpload onFileSelect={loadPDF} loading={loading} />
        </div>
      ) : (
        <div style={{ display: "flex", height: "calc(100vh - 57px)", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "auto", padding: 24, background: "#EDEDEB" }}>
            {loading && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                Loading pages…
              </div>
            )}
            {pages.map((page, i) => (
              <PDFPageCanvas
                key={`${previewMode ? "p" : "o"}-${i}`}
                page={page} pageNum={i + 1} scale={scale}
                onTextItemClick={handleTextItemClick}
                selectedItemIndex={selection?.pageNum === i + 1 ? selection.index : null}
                edits={edits}
              />
            ))}
          </div>

          <div style={{
            width: 340, minWidth: 340,
            borderLeft: "1px solid var(--border)", background: "var(--surface)",
            display: "flex", flexDirection: "column", overflow: "auto",
          }}>
            <EditPanel
              selection={selection} existingEdit={existingEdit}
              onSave={handleSaveEdit}
              onCancel={() => { setSelection(null); setEditingIndex(null); }}
            />
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <EditsLog edits={edits} onRemove={handleRemoveEdit} onClickEdit={handleClickEditLog} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

# PDF Text Editor

Client-side PDF text editor. Upload a PDF, click on text to edit, download the modified file. No backend required — everything runs in the browser.

## Tech Stack

- React 18 + Vite
- pdfjs-dist (render & extract text)
- pdf-lib (modify & export PDF)

## Deploy to Vercel via GitHub

### Step 1 — Create GitHub Repo

1. Go to https://github.com/new
2. Name: `pdf-text-editor` (or anything)
3. Set to **Public** or **Private**
4. **Don't** add README (we already have one)
5. Click **Create repository**

### Step 2 — Upload Files

Since you use GitHub web interface:

1. On the new repo page, click **"uploading an existing file"**
2. Drag the entire project folder contents:
   - `package.json`
   - `vite.config.js`
   - `index.html`
   - `src/` folder (with `main.jsx`, `App.jsx`, `index.css`)
3. Commit

> **Tip:** GitHub web UI doesn't support folders directly. You can:
> - Use the **"Add file → Create new file"** and type `src/main.jsx` (the slash creates the folder)
> - Repeat for `src/App.jsx` and `src/index.css`

### Step 3 — Deploy on Vercel

1. Go to https://vercel.com/new
2. Click **Import** next to your `pdf-text-editor` repo
3. Framework Preset: **Vite** (should auto-detect)
4. Click **Deploy**
5. Done — Vercel will `npm install` + `npm run build` automatically

### Step 4 — Custom Domain (Optional)

1. In Vercel dashboard → your project → **Settings → Domains**
2. Add your custom domain
3. Follow DNS instructions

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## How It Works

1. Upload any PDF with vector text (from Word, Google Docs, etc.)
2. Hover over text on the preview — clickable highlight zones appear
3. Click a text item → edit panel opens on the right
4. Change text, font, and color
5. Click "Apply Edit" — edit is queued
6. Click "Download" — modified PDF is generated and downloaded

## Limitations (MVP)

- Scanned/image-based PDFs have no editable text
- Custom embedded fonts fall back to standard PDF fonts
- Old text is covered with a white rectangle — works on white backgrounds
- Complex rotated/overlapping layouts may have reduced accuracy

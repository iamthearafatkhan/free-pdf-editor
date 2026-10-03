# FreePDF Editor

**Free browser-based PDF editor — edit text in any PDF like Word.**
No sign-up. No subscription. No uploads. Your file never leaves your device.

🔗 **Live:** [pdfeditnow.pages.dev](https://pdfeditnow.pages.dev/)

---

## Why this exists

Most online PDF editors demand a subscription after one or two edits.
Adobe Acrobat, Smallpdf, iLovePDF — all have paywalls the moment you need
something real.

This is a free alternative. Everything runs **inside your browser** — no
server, no account, no tracking. Your PDF is never uploaded anywhere.

---

## Features

- ✏️ **Edit existing text** inside any PDF
- ➕ **Add new text** anywhere on the page (double-click empty space)
- 🔄 **Reflow like Word** — delete a line and the text below slides up
- 🎨 **Font matching** — Arial, Times, Courier, Calibri detected and preserved
- 💾 **Save as PDF** (visual match) **or DOCX** (fully editable in Word)
- 👁️ **Preview before download** — nothing saves until you approve it
- 🔒 **100% private** — no uploads, no accounts, no analytics, no tracking

---

## How it works

1. **PDF.js** renders each page to a canvas in the browser.
2. **Text items are extracted** with their exact position, font, size, and style.
3. An **editable overlay** is placed over each paragraph — you type directly on the page.
4. On export, **pdf-lib** white-outs the original text and writes your edits back
   using metric-identical substitute fonts (Arimo ≈ Arial, Tinos ≈ Times,
   Cousine ≈ Courier) so the result looks the same in any PDF viewer.
5. **DOCX export** writes the real font names so Word renders them correctly.

No backend. No server. All processing happens in the tab you already have open.

---

## Built with

| Library | Purpose | License |
|---|---|---|
| [PDF.js](https://github.com/mozilla/pdf.js) | Render PDF pages | Apache 2.0 |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | Create and modify PDFs | MIT |
| [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) | Embed custom fonts | MIT |
| [docx](https://github.com/dolanmiu/docx) | Generate DOCX files | MIT |
| [FileSaver.js](https://github.com/eligrey/FileSaver.js) | Save files in the browser | MIT |

---

## Deploy your own

This is a single `index.html` file. No build step.

### Cloudflare Pages (recommended — unlimited bandwidth)
1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com).
2. Workers & Pages → Create → Pages → **Upload assets**.
3. Drag the folder containing `index.html`, `robots.txt`, and `sitemap.xml`.
4. Done — deployed in ~30 seconds.

### GitHub Pages
1. Create a public repo, upload the files.
2. Settings → Pages → Deploy from branch → `main` / `root`.

---

## Keywords

free pdf editor · edit pdf online · pdf text editor · no sign up pdf editor ·
browser pdf editor · pdf editor without subscription · edit pdf like word ·
free pdf editor no watermark · online pdf editor free · pdf editor in browser

---

## Author

**Arafat Khan**

- 🌐 Portfolio: [arafatkhan.vercel.app](https://arafatkhan.vercel.app)
- 💻 GitHub: [@iamthearafatkhan](https://github.com/iamthearafatkhan)
- 💼 LinkedIn: [iamthearafatkhan](https://www.linkedin.com/in/iamthearafatkhan/)

---

## Contributing

Found a bug or want to add a feature? Open an issue or send a pull request.
Helpful contributions especially welcome for:

- Better handwriting / OCR support
- Multi-column PDF layouts
- Right-to-left language support (Arabic, Hebrew)

---

## License

MIT — free to use, fork, modify, and share. See [LICENSE](LICENSE) for details.

Built to be free forever.

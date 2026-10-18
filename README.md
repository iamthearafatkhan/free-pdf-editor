# 📄 FreePDF Editor & Merger

**A completely free, browser-based PDF editor and merger. Edit text in any PDF, combine multiple files, and fix page numbers — without uploading your files to a server.**

[![Live Site](https://img.shields.io/badge/Live_Site-pdfeditnow.pages.dev-blue?style=for-the-badge&logo=cloudflare)](https://pdfeditnow.pages.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25_Client_Side-brightgreen?style=for-the-badge)](https://pdfeditnow.pages.dev/)
[![No Subscriptions](https://img.shields.io/badge/Subscriptions-%240_Forever-success?style=for-the-badge)](https://pdfeditnow.pages.dev/)

## 🚀 Why this exists

Most online PDF editors (Smallpdf, iLovePDF, Adobe) hit you with a paywall the moment you need to do something useful. They also require you to upload your private documents to their servers.

**FreePDF Editor** solves both problems:
- It is **100% free** and open-source.
- It runs **entirely in your browser**. Your files never leave your device.
- It uses advanced web technologies to edit the actual PDF structure, preserving fonts and alignment.

---

## ✨ Features

- ✏️ **True PDF Text Editing**: Click any line of text and edit it exactly where it sits.
- 🔗 **Merge PDFs**: Drag, drop, reorder, and combine multiple PDFs into one.
- 🔢 **Auto-Fix Page Numbers**: Automatically updates "Page X of Y" and header/footer numbers after merging.
- 🎨 **Font & Alignment Preservation**: Retains original fonts (including LaTeX Computer Modern) and text alignment.
- 📝 **PDF to DOCX**: Convert PDFs to Word documents while preserving the layout as closely as possible.
- 🌙 **Day/Night Theme**: Easy on the eyes, with automatic system preference detection.
- 🔒 **Zero Server Uploads**: 100% privacy. No accounts, no tracking, no file limits.

---

## 🛠️ Built With (Tech Stack)

This project is built as a static web application using vanilla JavaScript and powerful open-source libraries. **No backend or database is required.**

| Tool | Purpose |
| :--- | :--- |
| [![PDF.js](https://img.shields.io/badge/-PDF.js-red)](https://mozilla.github.io/pdf.js/) | Renders PDF pages to the browser canvas. |
| [![pdf-lib](https://img.shields.io/badge/-pdf--lib-blue)](https://pdf-lib.js.org/) | Creates, modifies, and merges PDF documents in the browser. |
| [![docx](https://img.shields.io/badge/-docx-orange)](https://docx.js.org/) | Generates the exported Word (`.docx`) files. |
| [![FileSaver](https://img.shields.io/badge/-FileSaver.js-green)](https://github.com/eligrey/FileSaver.js/) | Handles downloading the generated files. |
| [![Fontkit](https://img.shields.io/badge/-fontkit-purple)](https://github.com/Hopding/fontkit) | Embeds custom fonts during the PDF export process. |

---

## 💻 How to Use

1. **Open the App**: Go to [pdfeditnow.pages.dev](https://pdfeditnow.pages.dev/).
2. **Edit Text**: Click "Open PDF" and select your file. Click on any line of text to edit it. Use the floating toolbar to change alignment or fonts.
3. **Merge PDFs**: Click "Merge PDFs" in the top bar. Drag and drop your files, reorder them, and click "Merge & Download".
4. **Fix Numbers**: If you merged files or added pages, click "Fix Numbers" to automatically update `Page 1`, `Page 2`, etc.
5. **Save**: Click "Save as PDF" for a visual snapshot, or "Convert to DOCX" to edit further in Microsoft Word.

---

## 🚀 Deploy Your Own (Free)

Because this is a static website, you can host it for free with unlimited bandwidth on Cloudflare Pages or Netlify.

1. Clone this repository or download the files.
2. Create a free account on [Cloudflare Pages](https://pages.cloudflare.com/).
3. Click **Create a project** → **Upload assets**.
4. Drag and drop the folder containing `index.html`, `style.css`, `app.js`, and your `img` folder.
5. Click **Deploy**. You will get a free URL like `your-project.pages.dev`.

---

## 👨‍💻 Author

**Arafat Khan**
- 🌐 Portfolio: [arafatkhan.vercel.app](https://arafatkhan.vercel.app)
- 💻 GitHub: [@iamthearafatkhan](https://github.com/iamthearafatkhan)
- 💼 LinkedIn: [iamthearafatkhan](https://www.linkedin.com/in/iamthearafatkhan/)

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE). 
Feel free to fork it, improve it, and use it for your own projects!

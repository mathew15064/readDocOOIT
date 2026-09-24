# 📂 Doc Reader

A local web app for indexing, searching, bookmarking, and quickly opening project documents that live in deeply nested folders — designed for developers who work with large documentation repos across multiple OS environments (Windows, WSL, Linux, macOS).

## ✨ Features

- **Auto-scan** — recursively indexes `.xlsx`, `.xls`, `.docx`, `.doc`, `.pptx`, `.ppt`, `.pdf`, `.csv`, `.txt`, `.md`, `.drawio`, `.a5er`, `.png`, `.jpg`, `.svg`
- **Version parsing** — extracts `V<n>_<yyyymmdd>` from filenames; sorts by version and highlights the latest
- **Fast search** — filename / module / version / tag search with manual Search button (no auto-load)
- **Sort + filter** — by name, version date, version number, file size; filter by module, tag, version, latest-only
- **Bookmark groups** — organize related docs into color-coded groups; view all items in a group with sort/filter
- **Document tags** — assign multiple tags per document; drag-and-drop to assign; filter by tag
- **Multi-option opener** — split button to open files with LibreOffice, Excel, or OS default; per-platform config
- **Inline web preview** — preview XLSX, CSV, PDF, images, and text/markdown directly in the browser
- **Reveal in folder** — open the actual folder in Windows Explorer / Finder / Linux file manager
- **Dark mode** — Binance-derived palette (near-black canvas, yellow primary, Inter body, JetBrains Mono for numbers/paths)
- **Responsive** — works on mobile, tablet, desktop (7-viewport audit)
- **Cross-platform** — Windows, WSL, Linux, macOS

## 🚀 Installation

### Prerequisites

- **Node.js 22+** — https://nodejs.org
- **LibreOffice** (optional but recommended) — https://www.libreoffice.org
- **Excel** (optional, Windows only)

### 1. Clone or copy the project

```bash
git clone <repo-url> ~/scan_doc
cd ~/scan_doc
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```ini
# Absolute path to the root folder containing your documents
DOC_ROOT_DIR=/home/your-user/path/to/documents

# Port to run the web server on
PORT=3081

# Platform mode: auto | wsl | windows | linux | darwin
# - auto (default): detect via /proc/version
# - wsl: force WSL key from config/openers.json
# - windows: force win32 key from config/openers.json
PLATFORM_MODE=auto
```

### 4. Configure openers (optional)

Edit `config/openers.json` to add or remove applications. Each opener has a `platforms` map — pick the right command per OS.

Example (Windows + WSL + Linux + macOS):

```json
{
  "openers": [
    {
      "id": "libre",
      "label": "LibreOffice",
      "icon": "[L]",
      "platforms": {
        "win32": {
          "command": "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
          "args": ["{file}"],
          "pathStrategy": "native"
        },
        "wsl": {
          "command": "/mnt/c/Program Files/LibreOffice/program/soffice.exe",
          "args": ["{file}"],
          "pathStrategy": "windows"
        },
        "linux": {
          "command": "libreoffice",
          "args": ["{file}"],
          "pathStrategy": "native"
        },
        "darwin": {
          "command": "/Applications/LibreOffice.app/Contents/MacOS/soffice",
          "args": ["{file}"],
          "pathStrategy": "native"
        }
      }
    },
    {
      "id": "default",
      "label": "OS Default",
      "icon": "[>]",
      "default": true,
      "platforms": {
        "win32": {
          "command": null,
          "args": [],
          "pathStrategy": "native"
        },
        "wsl": {
          "command": null,
          "args": [],
          "pathStrategy": "native"
        },
        "linux": {
          "command": null,
          "args": [],
          "pathStrategy": "native"
        },
        "darwin": {
          "command": null,
          "args": [],
          "pathStrategy": "native"
        }
      }
    }
  ]
}
```

### 5. Initialize database and scan

```bash
npm run migrate
npm run start
```

Open [http://localhost:3081](http://localhost:3081/). Click **Rescan Repo** and paste the absolute path to your documents folder (or leave the default from `.env`).

## 🛠️ Available Commands

| Command | Description |
|---|---|
| `npm run start` | Start the production server |
| `npm run dev` | Start with auto-reload (nodemon) |
| `npm test` | Run unit + integration tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |
| `npm run test:coverage` | Tests with code coverage |
| `npm run migrate` | Run database migrations |
| `npm run scan` | CLI scan (alternative to UI button) |
| `npm run shots` | Playwright screenshot capture (20 states) |

## 📁 Project Layout

```text
doc-reader/
├── config/             # Runtime configuration (openers.json)
├── data/               # SQLite database (gitignored)
├── docs/               # Architecture, ADRs, workflow
├── plans/              # Task plans
├── public/             # Frontend (Alpine.js + Tailwind CDN)
├── scripts/            # CLI tools + verification
├── src/
│   ├── config/         # Env + openers loader
│   ├── db/             # SQLite + migrations
│   └── modules/
│       ├── bookmarks/  # Bookmark groups + items
│       ├── documents/  # Search, list, versions
│       ├── opener/     # Multi-app opener + WSL helper
│       ├── parser/     # Filename → version/date/type
│       ├── preview/    # In-browser file preview
│       ├── scanner/    # Recursive folder walker
│       └── tags/       # Document tags
├── tests/              # Unit + integration + E2E
└── screenshots/        # Auto-captured UI states (gitignored)
```

## 🌐 OS-Specific Notes

### WSL (Windows Subsystem for Linux)

- Files on Windows drives (`/mnt/c/...`) — opened natively by Windows apps via `wslpath`
- Files on WSL filesystem (`/home/...`) — copied to `C:\temp\doc-reader\` on open (or revealed via `\\wsl.localhost\<distro>\...` UNC path)
- Temp copies are cleaned up automatically on server startup (older than 24h)

### Windows

- Everything works natively. No path conversion needed.

### Linux / macOS

- Uses `xdg-open` / `open` for the OS default opener. LibreOffice is available if installed.

## 🎨 Design System

Dark mode with Binance-derived palette:
- Canvas `#0b0e11`
- Primary CTA `#fcd535` (Binance yellow)
- `LATEST` `#0ecb81` (green), `OUTDATED` `#f6465d` (red)
- Body font: Inter
- Numbers/paths/code: JetBrains Mono

See `docs/ARCHITECTURE.md` for the design ADR.

## 📚 Documentation

- `docs/README.md` — router / entry point
- `docs/ARCHITECTURE.md` — ADRs, module boundaries
- `docs/PROJECT_STATE.md` — current phase, completed work
- `docs/WORKFLOW.md` — mandatory dev workflow
- `docs/LESSONS.md` — past bugs and patterns
- `docs/modules/*.md` — per-module specs

## 📄 License

Private / personal use. No license yet.

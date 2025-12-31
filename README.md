# Passcryption

A lightweight, secure desktop password manager built with Electron. Features AES-256 encryption, global hotkey quick-access, and a modern dark/light UI.

![Electron](https://img.shields.io/badge/Electron-28.x-47848F?logo=electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **AES-256 Encryption** - All passwords encrypted at rest using machine-derived keys
- **Global Hotkey** (`Ctrl+Shift+P`) - Access passwords from any application instantly
- **Password Generator** - Cryptographically secure generation with customizable rules
- **Auto-Type** - Bypass paste-blocking websites by simulating keyboard input
- **System Tray** - Runs quietly in background, always accessible
- **Dark/Light Themes** - System-aware theming with manual override

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Tray      │  │  Global     │  │    IPC Handlers     │ │
│  │   Menu      │  │  Shortcuts  │  │  (CRUD, Clipboard)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                            │                                │
│  ┌─────────────────────────┴────────────────────────────┐  │
│  │              Encryption Layer (AES-256)              │  │
│  │         Key derived from machine identifiers         │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌─────────────────────────┴────────────────────────────┐  │
│  │           Encrypted File Storage (.enc)              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
              Context Bridge (IPC)
                             │
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                         │
│  ┌──────────────────┐        ┌───────────────────────────┐ │
│  │   Main Window    │        │    Overlay Window         │ │
│  │  - Password List │        │  - Quick Search           │ │
│  │  - Create/Edit   │        │  - Keyboard Navigation    │ │
│  │  - Settings      │        │  - Copy/Auto-type         │ │
│  └──────────────────┘        └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Security

### Encryption
- Passwords encrypted using **AES-256** via CryptoJS
- Encryption key derived from machine-specific identifiers (hostname + username)
- Key never stored in plaintext or source code
- Data stored in `%APPDATA%/passcryption/passwords.enc`

### Password Generation
- Uses Node.js `crypto.randomBytes()` for all random operations
- Cryptographically secure Fisher-Yates shuffle
- Guarantees character class requirements without compromising randomness

### Process Isolation
- Electron context isolation enabled
- Node integration disabled in renderer
- All sensitive operations handled in main process via IPC

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Development
```bash
git clone https://github.com/juxstin1/passcryption.git
cd passcryption
npm install
npm start
```

### Build Executable
```bash
npm run build
```
Output: `dist/Passcryption.exe` (portable, no installation required)

## Usage

### Main Application
- **My Logins** - View, search, and manage saved passwords
- **New Login** - Add credentials with optional password generation
- **Settings** - Theme selection, clipboard auto-clear timing

### Quick Access Overlay
| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Toggle overlay |
| `↑` `↓` | Navigate results |
| `Enter` | Copy password to clipboard |
| `Tab` | Auto-type password |
| `Esc` | Close overlay |

### System Tray
- Left-click: Toggle main window
- Right-click: Context menu (Open, Quick Access, Quit)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron 28 |
| Encryption | CryptoJS (AES-256) |
| RNG | Node.js crypto module |
| Auto-type | Windows SendKeys API |
| Styling | CSS Custom Properties |

## Project Structure

```
passcryption/
├── main.js           # Electron main process, IPC handlers, encryption
├── preload.js        # Context bridge for main window
├── overlay-preload.js# Context bridge for overlay window
├── index.html        # Main application UI
├── overlay.html      # Quick-access overlay UI
├── renderer.js       # Main window logic, theme management
├── styles.css        # Theming system, component styles
└── package.json      # Dependencies and build config
```

## License

MIT

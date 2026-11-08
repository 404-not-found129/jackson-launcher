// What "Install" means for each project: download, then whatever setup makes it ready to use.
//
// needs:   things this computer must have, checked before installing
//          linux | arch | steamos | macos | kde | gnome | hyprland
// pkgs:    system packages (names from PKG below), installed with the system package manager
// confirm: shown before installing when setup changes the desktop or system
// inputs:  optional values asked for during setup, written to a .env file in the project
// steps:   commands run in the project folder, in a terminal. `answers` replies to known prompts.
// launch:  what the Launch button does. gui = start an app, term = run in the launcher's terminal,
//          open = open a file or folder
// guided:  setup needs you (choices, hardware, editing settings), so it runs interactively in the terminal
// after:   a short note shown once setup is done

const USER = '404-not-found129';
const APK_URL = `https://github.com/${USER}/aura-chatbot/releases/download/apk/aura-1.6.0-debug.apk`;

// repo, folder, category, branch, KB, language, description
const PROJECTS = [
  ['hypr-rice', 'hypr-rice', 'desktop', 'main', 378302, 'Python', 'Hyprland rice with switchable game themes: Elden Ring, Cyberpunk 2077, God of War and more.'],
  ['ocode', 'ocode', 'tools', 'main', 202, 'HTML', 'Local AI code editor powered by Ollama: Monaco editor, agentic chat, AI autocomplete, plugins.'],
  ['aura-chatbot', 'aura-chatbot', 'tools', 'master', 81745, 'Python', 'Aura, a chatbot app. Runs in Docker; also comes with an Android APK.'],
  ['cursor', 'cursor', 'tools', 'main', 5, null, 'Static REA analysis of the Cursor editor 3.24.18.'],
  ['hackintosh-toolkit', 'hackintosh-toolkit', 'system', 'main', 1311, 'Python', 'Python tools for setting up a Hackintosh.'],
  ['docky-settings', 'docky-settings', 'desktop', 'main', 13, 'Swift', 'Control panel and installer for multiple pinned Docky docks across monitors.'],
  ['docky-multimonitor', 'docky-multimonitor', 'desktop', 'main', 20856, 'Swift', 'Docky fork with multi-monitor pinning, Liquid Glass styling and faster startup.'],
  ['macos-kde', 'macos-kde', 'desktop', 'main', 67, 'Python', 'macOS-style theme setup for KDE Plasma.'],
  ['macos-tahoe-liquid-kde', 'macos-tahoe-liquid-kde', 'desktop', 'dev', 122658, 'CSS', 'macOS Tahoe Liquid Glass theme for KDE Plasma 6.6/6.7+ (fork).'],
  ['macos-for-kde', 'macos-for-kde', 'desktop', 'main', 53312, 'Shell', 'Shell scripts that give KDE Plasma a macOS look.'],
  ['chromebook-monitor-setup', 'chromebook-monitor-setup', 'system', 'main', 25, 'Shell', 'Turns a Chromebook into a wireless second monitor for a Hyprland PC.'],
  ['elden-mod-official', 'elden-mod-official', 'gaming', 'main', 22640, 'Python', 'Elden Ring save editor: runes, builds, items. Runs in your browser.'],
  ['....', 'elden-mod-earlier-copy', 'gaming', 'main', 22601, 'Python', 'Earlier working copy of the Elden Ring save editor.'],
  ['c-tutorial', 'c-tutorial', 'learn', 'main', 1, 'C', 'Exercises from learning C.'],
  ['nvidia_for_steamos', 'nvidia_for_steamos', 'gaming', 'main', 17, 'Shell', 'Installs NVIDIA graphics drivers on SteamOS.'],
  ['tour-of-go', 'tour-of-go', 'learn', 'main', 110, 'Go', 'A desktop app that walks through 20 Go concepts.'],
  ['go-calculator', 'go-calculator', 'learn', 'main', 4, 'Go', 'A command-line calculator written in Go.'],
  ['arch-aur-install', 'arch-aur-install', 'system', 'main', 4, 'Shell', 'Installs the popular AUR helpers (yay, paru, trizen) on Arch Linux.'],
  ['mac-os-for-gnome', 'mac-os-for-gnome', 'desktop', 'master', 18, 'Shell', 'Makes GNOME look like macOS.'],
  ['fastfetchconfig', 'fastfetchconfig', 'desktop', 'main', 9, 'Shell', 'Fastfetch configuration with a custom logo.'],
  ['steamos-custom-iso-', 'steamos-custom-iso-', 'gaming', 'main', 29, 'Shell', 'Builds a custom SteamOS-style ISO with NVIDIA drivers.'],
  ['math-solver', 'math-solver', 'tools', 'master', 7, 'Python', 'Solves a math problem from a screenshot.'],
  ['orginzer_script', 'orginzer_script', 'tools', 'master', 13, 'Python', 'Sorts your Downloads folder into Pictures, Documents and more.'],
  ['website', 'website', 'tools', 'main', 52, 'JavaScript', 'Personal website, built with JavaScript.'],
  ['reshade-shader', 'reshade-shader', 'gaming', 'main', 6, 'HLSL', 'ReShade shader adding sharpening, motion blur and other cinematic effects.'],
  ['windows-vm-ubuntu', 'windows-vm-ubuntu', 'system', 'main', 22, null, 'Creates a Windows 10 virtual machine for running Windows apps on Linux.'],
].map(([repo, folder, cat, branch, kb, lang, desc]) => ({ repo, folder, cat, branch, kb, lang, desc }));

// package names per package manager
const PKG = {
  gcc: { pacman: 'gcc', apt: 'gcc', dnf: 'gcc' },
  go: { pacman: 'go', apt: 'golang-go', dnf: 'golang' },
  fyne: { pacman: 'libxcursor libxrandr libxinerama libxi libxxf86vm mesa pkgconf', apt: 'libgl1-mesa-dev xorg-dev pkg-config', dnf: 'mesa-libGL-devel libXcursor-devel libXrandr-devel libXinerama-devel libXi-devel libXxf86vm-devel' },
  fastfetch: { pacman: 'fastfetch', apt: 'fastfetch', dnf: 'fastfetch' },
  tk: { pacman: 'tk', apt: 'python3-tk', dnf: 'python3-tkinter' },
  tesseract: { pacman: 'tesseract tesseract-data-eng', apt: 'tesseract-ocr', dnf: 'tesseract' },
  venv: { pacman: 'python', apt: 'python3-venv', dnf: 'python3' },
  docker: { pacman: 'docker', apt: 'docker.io', dnf: 'moby-engine' },
  ollama: { pacman: 'ollama' },
  wayshot: { pacman: 'grim slurp', apt: 'grim slurp', dnf: 'grim slurp' },
  vm: { pacman: 'virt-manager qemu-guest-agent dialog freerdp iproute2 libnotify openbsd-netcat cdrtools' },
};

const RECIPES = {
  'hypr-rice': {
    needs: ['arch', 'hyprland'],
    confirm: 'This replaces your Hyprland setup (keybinds, bar, launcher, terminal) with hypr-rice. Your current config is backed up to ~/.config-backup-<date> first. If you use Omarchy, only the themes are added and Omarchy stays.',
    steps: [{
      cmd: 'if command -v omarchy >/dev/null; then bash install-omarchy.sh; else bash install.sh; fi',
      answers: [[/Replace Omarchy's desktop config anyway\? \[y\/N\]/, 'n'], [/Continue\? \[y\/N\]/, 'y']],
    }],
    after: 'Log out and back in to see the new desktop.',
  },
  ocode: {
    needs: ['linux'], pkgs: ['venv', 'ollama'],
    steps: [
      { cmd: 'bash install.sh' },
      { cmd: 'if command -v systemctl >/dev/null && ! curl -s -m 2 http://127.0.0.1:11434 >/dev/null; then sudo systemctl enable --now ollama || true; fi', optional: true },
    ],
    launch: { type: 'gui', cmd: '"$HOME/.local/bin/ocode-gui"' },
    after: 'ocode is in your app menu. Pick an AI model in its settings the first time; it downloads it for you.',
  },
  'aura-chatbot': {
    needs: ['linux'], pkgs: ['docker'], apk: true,
    inputs: [
      { key: 'GEMINI_API_KEY', label: 'Gemini API key', hint: 'Optional. Leave any of these empty and add them later in the .env file.' },
      { key: 'OPENAI_API_KEY', label: 'OpenAI API key' },
      { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API key' },
    ],
    steps: [{ cmd: 'bash install.sh', answers: [[/add it to your PATH\? \(y\/N\)/, 'y']] }],
    launch: { type: 'term', cmd: '"$HOME/.local/bin/aura"' },
    after: 'If Docker was just installed, log out and back in once so Aura can use it without a password. The Android APK is in the aura-chatbot-apk folder.',
  },
  cursor: { launch: { type: 'url', url: `https://github.com/${USER}/cursor#readme`, label: 'Read' } },
  'hackintosh-toolkit': {
    needs: ['linux'], guided: true,
    note: 'Walks you through making a macOS installer. One step erases the USB drive you choose.',
    launch: { type: 'term', cmd: 'bash install.sh', label: 'Start' },
  },
  'docky-settings': { needs: ['macos'] },
  'docky-multimonitor': { needs: ['macos'] },
  'macos-kde': {
    needs: ['kde'],
    confirm: 'This changes your KDE Plasma look: theme, icons, dock and window style.',
    steps: [{ cmd: 'bash install.sh' }],
    after: 'Log out and back in to see the full theme.',
  },
  'macos-tahoe-liquid-kde': {
    needs: ['kde'],
    confirm: 'This installs the macOS Tahoe theme system-wide (themes, icons, cursors, login screen). It needs your password.',
    steps: [{ cmd: 'sudo ./install' }],
    after: 'Log out and back in to see the theme. Switch light/dark with mac-tahoe-theme-switch.',
  },
  'macos-for-kde': {
    needs: ['kde'],
    confirm: 'This adds the glassOS theme to KDE Plasma. For the full glass look you also need the Glass widget style.',
    steps: [{ cmd: 'sh install.sh' }],
    after: 'Pick glassOS in System Settings, or run glassos-theme auto.',
  },
  'chromebook-monitor-setup': {
    needs: ['arch', 'hyprland'], guided: true,
    note: 'Set your PC and Chromebook IP addresses at the top of install.sh first (Open the folder to edit it).',
    launch: { type: 'term', cmd: 'bash chromebook-monitor-setup/install.sh pc', label: 'Start' },
  },
  'elden-mod-official': {
    needs: ['linux'],
    launch: { type: 'term', cmd: 'cd elden-mod && python3 app.py', label: 'Launch' },
    after: 'Launch starts the editor and opens it in your browser. Keep edited characters offline.',
  },
  'elden-mod-earlier-copy': {
    needs: ['linux'],
    launch: { type: 'term', cmd: 'cd elden-rune-editor && python3 app.py', label: 'Launch' },
  },
  'c-tutorial': {
    needs: ['linux'], pkgs: ['gcc'],
    steps: [{ cmd: 'gcc program.c -o program' }],
    launch: { type: 'term', cmd: './program' },
  },
  nvidia_for_steamos: {
    needs: ['steamos'], guided: true,
    note: 'Installs NVIDIA drivers on SteamOS and asks to reboot at the end.',
    launch: { type: 'term', cmd: 'sudo bash nvidia_for_steamos/install.sh', label: 'Start' },
  },
  'tour-of-go': {
    needs: ['linux'], pkgs: ['go', 'gcc', 'fyne'],
    steps: [{ cmd: 'go build -o tour-of-go tour.go' }],
    launch: { type: 'gui', cmd: './tour-of-go' },
    after: 'The first build takes a few minutes; after that it starts instantly.',
  },
  'go-calculator': {
    needs: ['linux'], pkgs: ['go'],
    steps: [{ cmd: 'cd "go lightweght calculator" && go build -o calculator .' }],
    launch: { type: 'term', cmd: '"./go lightweght calculator/calculator"' },
  },
  'arch-aur-install': {
    needs: ['arch'],
    confirm: 'This builds and installs yay, paru and trizen. It takes a few minutes and needs your password.',
    steps: [{ cmd: 'bash install-aur-helpers.sh' }],
    after: 'yay, paru and trizen are ready to use in any terminal.',
  },
  'mac-os-for-gnome': {
    needs: ['gnome'],
    confirm: 'This changes your GNOME look: theme, icons, cursors, dock and extensions.',
    steps: [{ cmd: 'bash install.sh', answers: [[/Press Enter to continue anyway/, '']] }],
    after: 'Log out and back in to see the full theme.',
  },
  fastfetchconfig: {
    needs: ['linux'], pkgs: ['fastfetch'],
    steps: [{ cmd: 'bash install.sh' }],
    launch: { type: 'term', cmd: 'fastfetch', label: 'Show it' },
    after: 'Your old fastfetch config, if any, was saved as config.jsonc.backup.',
  },
  'steamos-custom-iso-': {
    needs: ['linux'], guided: true,
    note: 'Builds a bootable ISO with Docker or Podman. Needs about 10 GB free and some time.',
    launch: { type: 'term', cmd: 'bash build.sh', label: 'Build ISO' },
  },
  'math-solver': {
    needs: ['linux'], pkgs: ['venv', 'tk', 'tesseract', 'wayshot'],
    steps: [{ cmd: 'python3 -m venv .venv && .venv/bin/pip install -q --disable-pip-version-check Pillow pyautogui pytesseract numexpr' }],
    launch: { type: 'gui', cmd: '.venv/bin/python math_solver.py' },
  },
  orginzer_script: {
    needs: ['linux'], pkgs: ['tk'],
    launch: { type: 'gui', cmd: 'python3 "orginzer script.py"' },
    after: 'Click Start Watching: new files in Downloads get sorted into Images, Documents, Code and other folders inside Downloads.',
  },
  website: { launch: { type: 'open', path: 'public/index.html', label: 'Open site' } },
  'reshade-shader': {
    pickFolder: { title: 'Choose the game folder that has ReShade installed', file: 'rtx.fx', into: 'reshade-shaders/Shaders' },
    after: 'Turn on "RTX Cinema Nitro" in the ReShade menu in game (Home key). Use "Add to another game" for more.',
  },
  'windows-vm-ubuntu': {
    needs: ['arch'], pkgs: ['vm'], guided: true,
    note: 'Downloads Windows and builds a virtual machine. Needs an AUR helper for virtio-win, about 40 GB free, and some time.',
    launch: { type: 'term', cmd: '(command -v paru >/dev/null && paru -S --needed virtio-win) || (command -v yay >/dev/null && yay -S --needed virtio-win); ./qemu.sh', label: 'Start' },
  },
};

module.exports = { USER, APK_URL, PROJECTS, PKG, RECIPES };

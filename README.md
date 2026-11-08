# Jackson Launcher

A desktop app for installing my projects. Pick one and click **Install**: it downloads the project, installs any system packages it needs, runs its setup, and gives you a **Launch** button. No terminal needed.

![Jackson Launcher](renderer/hypr-rice.gif)

## Install

One command, no sudo:

```bash
curl -fsSL https://raw.githubusercontent.com/404-not-found129/jackson-launcher/main/install.sh | bash
```

It downloads the latest release, checks it against its checksum, installs it to `~/.local/opt/jackson-launcher`, and adds **Jackson Launcher** to your app menu plus a `jackson-launcher` command. Run the same command again to update. To remove it:

```bash
curl -fsSL https://raw.githubusercontent.com/404-not-found129/jackson-launcher/main/install.sh | bash -s -- --uninstall
```

Prefer to download it yourself? Grab the AppImage or tar.gz from [Releases](https://github.com/404-not-found129/jackson-launcher/releases/latest). The AppImage needs `fuse2`.

Linux x86-64 only.

## What Install does

Each project has a recipe in [`recipes.js`](recipes.js):

| Kind | What happens | Projects |
|---|---|---|
| One-click setup | Downloads, installs packages, runs setup, ready to launch | hypr-rice, ocode, aura-chatbot, c-tutorial, go-calculator, tour-of-go, math-solver, fastfetchconfig, arch-aur-install, orginzer_script, elden mods, website, cursor, reshade-shader |
| Guided | Downloads, then runs step by step in the built-in terminal because it needs your choices | hackintosh-toolkit, chromebook-monitor-setup, steamos-custom-iso-, windows-vm-ubuntu, nvidia_for_steamos |
| Download only | Needs a different desktop or system | KDE and GNOME themes (unless you run them), Docky (macOS) |

The app checks your system first (distro, desktop, package manager) and only runs setups that fit it. Projects that change your desktop ask before installing. Your config is backed up by each project's own installer.

When a setup needs admin rights, the app asks for your password in its own dialog and passes it to `sudo`. It's kept in memory only for that one install and never saved.

Projects go into `~/jackson-projects` (change it in the sidebar). Setup output appears in the Terminal drawer at the bottom, where you can also type.

## Build it yourself

```bash
npm install
npm start          # run from source
npm run dist       # build the AppImage and tar.gz into dist/
```

Needs Node.js 20 or newer.

## License

MIT

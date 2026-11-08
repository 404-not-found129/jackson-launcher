# Jackson Launcher

A desktop app for installing my projects. Pick one and click **Install**: it downloads the project, installs any system packages it needs, runs its setup, and gives you a **Launch** button. No terminal needed.

![Jackson Launcher](renderer/hypr-rice.gif)

## Download

Get the latest version from [Releases](https://github.com/404-not-found129/jackson-launcher/releases/latest):

- **JacksonLauncher-x.y.z.AppImage**: make it executable and double-click it. It adds itself to your app menu the first time it runs.
  ```bash
  chmod +x JacksonLauncher-*.AppImage && ./JacksonLauncher-*.AppImage
  ```
  If it doesn't start and mentions FUSE, install `fuse2` (Arch: `sudo pacman -S fuse2`) or use the tar.gz.
- **JacksonLauncher-x.y.z.tar.gz**: unpack it anywhere and run `jackson-launcher` inside. It also adds itself to your app menu.

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

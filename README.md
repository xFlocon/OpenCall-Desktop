# OpenCall Desktop

OpenCall Desktop is a self-hosted community, chat, voice, camera, file-sharing, and WebRTC screen-sharing application for Linux and Windows.

This repository contains:

- Electron desktop client for Linux and Windows
- Embedded OpenCall server AppImage builder
- Voice, camera, community calls, private DM calls, and screen sharing
- Resumable file uploads and in-app download progress
- Friends, DMs, communities, channels, roles, invitations, and moderation
- Linux VA-API and multi-GPU controls
- Windows ANGLE/DXGI GPU preferences
- RNNoise WASM microphone noise suppression

The current user interface is in Brazilian Portuguese. Documentation is in English.

## Downloads

Prebuilt packages are published under [GitHub Releases](../../releases):

- Linux x86_64 AppImage
- Windows x64 installer
- Windows x64 portable executable and ZIP
- Linux x86_64 server AppImage

## Requirements

### Client

- Linux x86_64 with PipeWire or PulseAudio, or Windows x64
- GPU drivers supplied by the operating system
- Microphone/camera permissions when those features are used

### Server

- Linux x86_64
- Persistent access to the same user configuration and data directories across upgrades
- Public TLS/WebSocket endpoint and TURN configuration for Internet deployments

The server does not automatically add new accounts to communities. Membership requires an invitation or community creation.

## Validate

```bash
bash validate.sh
```

Validation checks JavaScript syntax, embedded server Python, HTML/JS references, WebRTC regressions, role hierarchy, membership rules, and packaging assumptions.

## Build Linux Client

```bash
bash build-appimage.sh
```

Output:

```text
dist/OpenCall-Desktop-0.7.61-x86_64.AppImage
```

## Build Windows Client on Linux

Requires NSIS (`makensis`). The script can install supported dependencies when `AUTO_INSTALL_DEPS=1`.

```bash
bash build-opencall-windows-v0.7.61-v2-arch-fix.sh .
```

Default output directory:

```text
dist-windows/
```

## Build Server

```bash
bash server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh
```

The server builder targets Arch Linux x86_64 and may install build dependencies. Back up server data and configuration before replacing a running server.

## WebRTC Integration Test

Extract a clean Electron Linux runtime, then run:

```bash
node scripts/check-screen-e2e.cjs /absolute/path/to/electron
```

This starts two isolated Electron processes, negotiates a synthetic video stream through OpenCall's real screen-sharing functions, checks playback, and tests viewer re-entry. It does not benchmark real monitor capture, hardware encoding, Windows, or 1080p60 performance.

## Configuration

OpenCall ships with a configurable public signaling endpoint. Change it under connection settings for self-hosted deployments. Accounts, friends, DMs, and communities belong to the selected connection server.

## Security

- Keep server and client builds aligned when deploying new protocol or moderation features.
- Use `wss://` and trusted TLS certificates over the Internet.
- Restrict TURN credentials and server access appropriately.
- Role hierarchy and ownership checks are enforced by the server, not only by the interface.

## License

[MIT](LICENSE)

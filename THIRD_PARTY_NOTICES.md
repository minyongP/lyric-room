# Third-party notices

- Noto Sans KR and Noto Sans JP are distributed through the pinned @fontsource packages under the SIL Open Font License 1.1. Their full license text is in `node_modules/@fontsource/noto-sans-kr/LICENSE` and `node_modules/@fontsource/noto-sans-jp/LICENSE`. Copies are included in `public/fonts/` so they accompany built artifacts.
- React, Vite, Express, Zod, fft.js and other dependencies retain their own licenses in their npm packages. See package-lock.json for exact versions.
- Lucide icons are provided by lucide-react under ISC.
- Playwright is provided under Apache-2.0 and downloads Chromium separately. Chromium retains its bundled third-party notices.
- For direct installation, FFmpeg is an external executable supplied by the user. The Dockerfile installs Debian’s FFmpeg package and its dependencies into the locally built image; binaries are not committed to this repository. Package license notices are available under `/usr/share/doc/` inside the image (including `ffmpeg/copyright`). Build options determine the applicable license; this app invokes libx264 and AAC for export.
- The Docker build installs Chromium and Linux dependencies through the locked Playwright version. Browser files are stored under `/ms-playwright`; their bundled notices and the Debian package notices remain in the image. The application license does not replace them.

The app's Apache-2.0 license does not relicense these components or user media.

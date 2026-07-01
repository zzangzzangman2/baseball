# KBO GM Manager 데스크톱 패키징

이 앱은 지금은 `index.html`, `src/`, `assets/`를 직접 다루는 정적 ESM 웹 앱으로 개발합니다. 데스크톱 배포가 필요해지면 같은 파일을 Electron 창에서 열고 `electron-builder`로 Windows EXE/설치 파일을 만듭니다.

## 흐름

1. 웹 앱은 기존처럼 HTML/CSS/JS 기준으로 개발합니다.
2. 데스크톱 확인이 필요할 때만 Electron을 실행합니다.
3. 배포 시점에 `electron-builder`로 `dist/` 산출물을 만듭니다.

## 명령

```powershell
npm install
npm run dev
npm run start
npm run package
```

- `npm run dev`, `npm run start`: Electron 창에서 현재 `index.html` 실행
- `npm run package`: Windows x64용 NSIS 설치 파일과 portable EXE 생성
- `npm run package:dir`: 설치 파일 없이 패키징 폴더만 빠르게 생성

## Electron을 고른 이유

현재 앱은 정적 ESM HTML 앱이라 Chromium이 함께 포함되는 Electron이 로컬 모듈 로딩과 Windows 패키징을 예측하기 쉽습니다. `electron-builder`만 붙이면 EXE 산출물까지 바로 이어지고, Rust 툴체인도 필요 없습니다.

Tauri는 결과물이 더 가볍고 OS 기본 WebView를 쓰는 장점이 있지만, Rust 설치와 플랫폼별 WebView 차이를 함께 관리해야 합니다. 이 프로젝트는 먼저 웹으로 빠르게 만들고 나중에 EXE로 포장하는 흐름이므로 Electron이 더 단순한 선택입니다.

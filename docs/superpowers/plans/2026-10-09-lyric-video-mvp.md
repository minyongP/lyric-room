# 가사 플레이어 · 영상 제작 MVP Implementation Plan

> 공개 라이선스는 2026-10-09 사용자 요청에 따라 Apache-2.0으로 변경했습니다. 아래 MIT 언급은 초기 계획 기록입니다.
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로컬 MP3와 시간별 가사로 꾸민 음악 화면을 재생하고 1080p MP4로 저장한다.

**Architecture:** React 편집기와 Node.js 로컬 서버를 같은 Origin으로 제공한다. 공통 Canvas 렌더러가 시간 기반으로 장면을 만들며, 미리보기와 헤드리스 Chromium 출력에서 동일한 프로젝트 스냅샷과 오디오 분석 데이터를 사용한다. FFmpeg가 프레임 스트림과 원본 MP3를 합쳐 MP4를 만든다.

**Tech Stack:** TypeScript, React, Vite, Node.js, Express, Zod, Vitest, Playwright, FFmpeg/ffprobe. 설치 시 공식 문서와 로컬 런타임을 확인해 호환 버전을 고정하고 lockfile을 커밋한다.

**Spec:** `docs/superpowers/specs/2026-10-09-lyric-video-mvp-design.md` (사용자 승인: 2026-10-09).

## Global Constraints

- 첫 검증 환경은 macOS와 Chromium 브라우저다.
- 기본 UI 언어는 한국어다.
- 음악은 사용자가 선택한 폴더의 MP3만 사용한다.
- 배경은 JPEG/PNG/WebP 또는 MP4(H.264), 커버는 JPEG/PNG/WebP를 지원한다.
- 영상은 1920×1080, 30fps, H.264, yuv420p, AAC 오디오의 MP4로 만든다.
- 현재 구절의 범위는 start ≤ t < end다.
- 서버는 루프백 주소에만 바인딩한다.
- 사용자 자산이나 가사를 외부 서버에 전송하지 않는다.
- 작업은 한 번에 하나만 실행한다.
- 원본 파일은 수정하지 않는다.
- 기본 코드 라이선스는 MIT. 폰트·의존성 고지는 별도로 제공하고 사용자 미디어는 커밋하지 않는다.
- AI API, 여러 곡 합치기, 유튜브 업로드, 클라우드, 설치형 패키징은 제외한다.
- 각 작업의 테스트는 구현 전에 작성하고 실제 실패를 확인한다. 단순 스타일·문서 변경을 위한 중복 테스트는 만들지 않는다.

## Review Focus

- 같은 파일명, 한글·공백 파일명: 상대 경로와 자산 ID로 구분하고 셸에서 실행되지 않아야 한다. Task 2.
- 빠른 곡/배경 변경: 이전 로딩 응답이 새 선택을 덮거나 이전 소리가 계속 재생되지 않아야 한다. Task 5.
- 배경 영상 루프 경계와 무음 구간: 올바른 영상 프레임과 실제 에너지에 맞는 시각 효과를 보여야 한다. Task 3/4/7.
- 취소·디스크 저장 실패·FFmpeg 비정상 종료: 거짓 완료 없이 재시도가 가능하고 정상 출력은 보존해야 한다. Task 2/6.
- 폰트 로딩과 매우 긴 다국어 가사: 출력 시작 전에 글꼴 준비를 기다리고 넘침을 사용자에게 알려야 한다. Task 4/7.

## 파일과 책임

```text
src/shared/{project,lyrics,timeline}.ts       데이터 계약·검증·구간 탐색
src/audio/{fft,spectrum}.ts                  결정적 오디오 분석
src/scene/{layout,text,draw,media}.ts         공유 장면·텍스트 배치·영상 탐색
src/editor/{App,Library,Inspector,Transport,ExportPanel}.tsx
src/editor/{api,usePlayback,useProject,styles}.ts[x/css]
src/render/{main,bridge}.ts                  헤드리스 출력 진입점
server/{index,auth,routes}.ts                로컬 HTTP·Origin/토큰 검증
server/{store,assets,probe,analysis}.ts      자산·저장·메타데이터·PCM 분석
server/export/{jobs,worker,encode}.ts        출력 상태·프레임·인코딩
tests/{shared,server,audio,scene}/*.test.ts   계약과 오류 회귀 테스트
tests/e2e/{editor,export}.spec.ts            실제 브라우저 검증
scripts/{dev,fixtures,verify-export}.ts     실행·생성 샘플·미디어 검증
public/fonts/                              로컬 폰트와 라이선스
examples/{lyrics.json,ai-prompt.md}         가사 입력 예시와 외부 AI 안내
README.md, LICENSE, THIRD_PARTY_NOTICES.md
```

`.local-data/projects/<uuid>/{project.json,assets/}`에 사용자 자료, `.local-data/jobs/<uuid>/`에 임시 자료, `.local-data/exports/`에 완료 영상을 저장한다. `.local-data/`, 테스트 미디어, 빌드 산출물은 Git에서 제외한다. dev는 서버가 Vite를 middleware로 제공하고 production은 빌드된 정적 파일을 제공한다.

## Task 1: 프로젝트 계약과 가사 타임라인

**Files:** Create `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `src/shared/{project,lyrics,timeline}.ts`; Test `tests/shared/lyrics.test.ts`.

**Interfaces:**
- `LyricCue = { start:number; end:number; original:string; pronunciation?:string; translation?:string }`.
- `Project = { schemaVersion:1; id:string; title:string; artist:string; duration:number; audioId:string; backgroundId?:string; coverId?:string; lyrics:LyricCue[]; style:Style; output:{width:1920;height:1080;fps:30} }`.
- `Style = { fontSize:number; textColor:string; panelOpacity:number; backgroundBlur:number; backgroundBrightness:number; visualizerColor:string }`; 기본값 `48, '#ffffff', 0.28, 8, 0.7, '#d7e8e0'`. 범위는 폰트 24–72, 투명도 0–1, 흐림 0–30px, 밝기 0–1.5.
- `parseLyrics(input:unknown, duration:number): {ok:true; lyrics:LyricCue[]}|{ok:false; errors:{cue:number|null; field:string; message:string}[]}`. 버전 생략은 1, 다른 버전은 오류.
- `cueWindow(cues:LyricCue[], t:number): {previous:number|null;current:number|null;next:number|null}`.

- [ ] 테스트 실행 설정과 필수 개발 의존성을 준비한다. 제품 코드 없이 아래 실패 테스트를 작성한다.

```ts
expect(cueWindow([{start:1,end:2,original:'가'}], 1).current).toBe(0);
expect(cueWindow([{start:1,end:2,original:'가'}], 2).current).toBeNull();
expect(parseLyrics({lyrics:[]}, 3)).toEqual({ok:true,lyrics:[]});
```

겹치는 구간, 역순, 음수, Infinity/NaN, 곡 길이 초과, 공백 원문, 잘못된 필드 타입을 거부하는 테이블 테스트도 작성한다. 전주/중간 공백/후주에는 current=null이며 양옆 구절만 반환함을 검증한다.
- [ ] `npx vitest run tests/shared/lyrics.test.ts`가 아직 없는 구현 때문에 실패하는지 확인한다.
- [ ] 계약·기본값·검증·이진 탐색을 구현한다. 비정상 JSON 구문은 호출부가 별도로 표시하며 입력을 자동 재정렬하지 않는다.
- [ ] 같은 테스트와 `npx tsc --noEmit` 통과를 확인한다.
- [ ] 관련 파일만 커밋한다: `feat : 프로젝트와 가사 타임라인 계약 구현`.

## Task 2: 로컬 자산과 프로젝트 저장 API

**Files:** Create `server/{index,auth,routes,store,assets,probe}.ts`, `scripts/dev.ts`; Test `tests/server/{store,assets,auth}.test.ts`.

**Interfaces:**
- `Asset = {id:string;kind:'audio'|'image'|'video';originalName:string;relativeName:string;duration?:number;width?:number;height?:number}`.
- `createStore(root:string): Store`; `Store.create():Promise<{id:string}>`, `save(project:Project):Promise<void>`, `load(id:string):Promise<Project>`, `list():Promise<{id:string;title:string}[]>`, `importAsset(projectId:string,file:IncomingAsset):Promise<Asset>`, `resolveAsset(projectId:string,assetId:string):Promise<string>`.
- `IncomingAsset = { temporaryPath:string; originalName:string; relativeName:string; role:'audio'|'background'|'cover' }`; temporaryPath는 서버 업로드 처리기가 만든 값이다.
- HTTP: `GET /api/session`, `GET /api/health`, `POST /api/projects`, `GET /api/projects`, `GET|PUT /api/projects/:id`, `POST /api/projects/:id/assets`(multipart), `GET /api/projects/:id/assets/:assetId`(Range 지원). 변경 API는 `X-Session-Token`과 Origin을 확인한다.
- `probeFile(path:string):Promise<{duration:number;audioCodec?:string;videoCodec?:string;width?:number;height?:number}>`; 자산 역할에 따라 실제 포맷/코덱을 검증한다.

- [ ] 임시 디렉터리 테스트에 저장소 재생성 후 동일 프로젝트 복구, 중복 파일명 자산 ID 분리, `../`와 절대 상대경로 거부, 한글/공백 이름 보존을 작성한다. `expect(restored).toEqual(project)` 및 `expect(assetA.id).not.toBe(assetB.id)`를 사용한다.
- [ ] 인증 테스트에 `expect(foreignOriginWrite.status).toBe(403)`와 잘못된 토큰 거부를 추가한다. 손상/위장 확장자 파일 거부, 실패한 원자적 저장이 기존 project.json을 보존하는 테스트를 작성한다.
- [ ] `npx vitest run tests/server` 실패를 확인한다.
- [ ] UUID 서버 경로, 임시 파일→rename 원자적 저장, 업로드 스트림, `spawn` 인자 배열 기반 ffprobe 검사, 루프백 서버를 구현한다. 자산 누락은 설명 가능한 404, 입력 오류는 400, 실행 도구 누락은 health의 기능 상태로 반환한다. 설정 저장 시 참조 자산과 소속 프로젝트를 확인한다.
- [ ] `npx vitest run tests/server` 통과와 MP3 Range 요청의 206 응답을 확인한다.
- [ ] 커밋: `feat : 로컬 자산과 프로젝트 저장 구현`.

## Task 3: 재현 가능한 오디오 비주얼라이저 분석

**Files:** Create `src/audio/{fft,spectrum}.ts`, `server/analysis.ts`; Modify `server/routes.ts`; Test `tests/audio/spectrum.test.ts`.

**Interfaces:**
- `Spectrum = {fps:30;bands:32;frames:number[][]}`.
- `analyzePcm(samples:Float32Array,sampleRate:number):Spectrum`, `spectrumAt(data:Spectrum,t:number):number[]`.
- `createSpectrumAnalyzer(sampleRate:number):{push(chunk:Float32Array):void;finish():Spectrum}`는 서버의 스트리밍 입력을 처리한다. analyzePcm은 테스트용 전체 버퍼를 같은 분석기에 전달하는 래퍼다.
- `ensureAnalysis(projectId:string,audioId:string):Promise<Spectrum>`; `GET /api/projects/:id/analysis/:audioId`는 해당 자산의 분석 데이터를 반환한다.

- [ ] `expect(spectrumAt(analyzePcm(new Float32Array(24000),24000),0).every(v=>v===0)).toBe(true)`와 낮은/높은 주파수 사인파가 서로 다른 대역에서 최대값을 갖는 테스트를 작성한다. 역순 시간 조회 결과가 순차 조회와 같아야 한다.
- [ ] `npx vitest run tests/audio` 실패를 확인한다.
- [ ] 24kHz mono PCM, 2048 샘플 Hann 창, 32 로그 대역(40Hz–12kHz), 초당 30개 결과, 고정 dB 정규화와 사전 평활화를 구현한다. 분석 중 입력 PCM은 제한된 버퍼로 처리하고 결과만 유지한다. 오디오 자산별 결과를 캐시한다.
- [ ] 테스트 통과와 실제 생성 MP3 분석의 유한한 0–1 값, 무음 바닥값을 확인한다.
- [ ] 커밋: `feat : 음원 기반 비주얼라이저 분석 구현`.

## Task 4: 가사·배경 공통 장면 렌더러

**Files:** Create `src/scene/{layout,text,draw,media}.ts`, `src/render/{main,bridge}.ts`, `public/fonts/`, `render.html`; Test `tests/scene/layout.test.ts`, `tests/e2e/scene.spec.ts`.

**Interfaces:**
- `layoutCue(cue:LyricCue,fontSize:number,measure:(text:string,size:number)=>number):{lines:{text:string;size:number}[];overflow:boolean}`는 폭 1600px, 높이 300px의 현재 가사 슬롯에 원문·발음·번역을 배치한다. 이전/다음 슬롯은 동일 결과를 축소해 사용한다.
- `SceneMedia = {background?:CanvasImageSource;cover?:CanvasImageSource}`; `drawScene(ctx:CanvasRenderingContext2D,project:Project,t:number,spectrum:Spectrum,media:SceneMedia):{overflowCueIndices:number[]}`.
- `loadSceneMedia(project:Project,resolveUrl:(id:string)=>string):Promise<SceneMediaController>`; controller는 `at(t:number):Promise<SceneMedia>`, `dispose():void`를 제공한다.
- `window.renderBridge.prepare(project:Project,spectrum:Spectrum):Promise<void>`, `render(t:number):Promise<string>`; render 결과는 PNG data URL이며 캡처 전 폰트·배경 프레임 준비를 기다린다.

- [ ] 장면 테스트에서 현재 구절 강조, 누락 발음/번역의 공간 제거, 긴 가사 줄바꿈과 최소 크기(24px) 이후 넘침 보고를 검증한다. 예: `expect(layoutCue(longCue,48,measure).overflow).toBe(true)`에서 longCue는 1만 글자 원문, measure는 문자 수×크기인 결정적 측정 함수다.
- [ ] 브라우저 테스트에서 2초 영상의 `at(2.1)`이 0.1초 프레임과 일치하고 무음인지 검사한다. 폰트 로딩을 지연시킨 동안 prepare가 완료되지 않는지 검증한다.
- [ ] `npx vitest run tests/scene` 및 `npx playwright test tests/e2e/scene.spec.ts` 실패를 확인한다.
- [ ] 고정 1920×1080 논리 좌표, cover 크롭, 기본 그라데이션, 가사 3개 슬롯, 반투명 패널, 곡 정보/진행, 하단 32대역을 구현한다. 재생 조작은 Canvas에 그리지 않는다. 곡/가사 제목은 텍스트로만 그린다. 폰트는 한글·일본어·라틴을 제공하는 Noto 계열을 로컬 배포하고 라이선스를 기록한다.
- [ ] 사진 decode, video seeked와 프레임 준비, 같은 시간 재요청, 짧은 영상 modulo 처리를 구현한다. dispose 시 미디어 URL/이벤트를 정리한다.
- [ ] 테스트 통과 후 0초·가사 경계·중간 시점 이미지를 직접 확인한다.
- [ ] 커밋: `feat : 가사와 배경 공통 렌더러 구현`.

## Task 5: 폴더·가사·꾸미기 편집기

**Files:** Create `index.html`, `src/main.tsx`, `src/editor/{App,Library,Inspector,Transport,ExportPanel}.tsx`, `src/editor/{api,usePlayback,useProject}.ts`, `src/editor/styles.css`, `examples/{lyrics.json,ai-prompt.md}`; Test `tests/e2e/editor.spec.ts`.

**Interfaces:**
- `usePlayback(audioUrl:string|undefined):{time:number;duration:number;playing:boolean;volume:number;play():Promise<void>;pause():void;seek(t:number):void;setVolume(v:number):void}`.
- `useProject():{project:Project|null;dirty:boolean;save():Promise<void>;open(id:string):Promise<void>;update(patch:Partial<Project>):void}`. 생성/곡 선택은 서버의 프로젝트·자산 계약을 사용한다.
- 편집기 API 래퍼가 session 토큰을 메모리에 보관한다. Canvas 미리보기는 Task 4의 동일한 렌더러를 사용한다.

- [ ] 브라우저 테스트에 폴더의 중복 이름 MP3 선택, 실제 재생/일시정지/탐색, 가사 붙여넣기 후 타임라인 변화, 잘못된 가사 입력 시 이전 값 유지, 저장 후 재접속 복구를 작성한다. 현재 시간은 지정 탐색값 ±0.15초 이내인지 확인한다.
- [ ] 빠른 곡/배경 변경 중 느린 이전 응답이 새 프로젝트를 덮지 않는 테스트를 추가한다. 미저장 전환의 저장/버리기/취소 동작을 검사한다.
- [ ] `npx playwright test tests/e2e/editor.spec.ts` 실패를 확인한다.
- [ ] 3열 편집기와 작은 화면 탭, 빈 상태, 폴더 선택(web기반 directory input), 가사 파일/텍스트 입력, 제목/아티스트/커버, 배경/스타일 폼, 프로젝트 목록과 저장을 구현한다. 선택한 MP3만 가져오고 이전 오디오는 정지한다. generation ID/AbortController로 낡은 요청을 무시한다. 조작 요소에 한국어 레이블과 키보드 포커스를 제공한다.
- [ ] 텍스트 넘침 경고, 미지원 파일/빈 폴더/디코딩 오류, 볼륨과 내보내기 오디오 구분(미리보기 볼륨만 변경)을 표시한다. 예시 JSON과 AI 프롬프트를 UI에서 복사할 수 있게 한다.
- [ ] 테스트 통과 후 데스크톱/좁은 화면을 확인하고 미리보기 screenshot을 기록한다.
- [ ] 커밋: `feat : 로컬 음악과 가사 편집 화면 구현`.

## Task 6: 실제 MP4 출력과 취소

**Files:** Create `server/export/{jobs,worker,encode}.ts`; Modify `server/routes.ts`, `src/editor/ExportPanel.tsx`; Test `tests/server/export.test.ts`, `tests/e2e/export.spec.ts`.

**Interfaces:**
- `ExportJob = {id:string;status:'queued'|'rendering'|'encoding'|'completed'|'failed'|'cancelled';progress:number;error?:string;downloadUrl?:string}`.
- `startExport(snapshot:Project):Promise<ExportJob>`, `getExport(id:string):ExportJob`, `cancelExport(id:string):Promise<void>`.
- `POST /api/exports`는 검증한 전체 프로젝트 스냅샷을 받는다. `GET /api/exports/:id`, `POST /api/exports/:id/cancel`, `GET /api/exports/:id/download`를 제공한다. 활성 작업이 있으면 409.

- [ ] 상태 테스트에 중복 시작 거부, 자산 누락 실패, FFmpeg 비정상 종료 시 failed, 취소 후 새 작업 시작, 다른 완료 파일 보존을 작성한다. `expect(job.status).not.toBe('completed')`를 인코더 종료 전 검사한다.
- [ ] 실제 3초 생성 음원 출력 테스트를 작성해 출력 파일 존재와 오디오 스트림을 검사한다. export 시작 후 편집을 바꿔도 snapshot이 바뀌지 않는지 검증한다.
- [ ] `npx vitest run tests/server/export.test.ts` 및 `npx playwright test tests/e2e/export.spec.ts` 실패를 확인한다.
- [ ] 헤드리스 Chromium을 실행하고 renderBridge에 스냅샷/분석을 전달한다. 프레임 `n/30`을 순서대로 받아 `image2pipe`로 전송하며 stdin backpressure를 기다린다. FFmpeg에 원본 MP3, libx264, yuv420p, AAC, 명시적 곡 길이, faststart를 전달한다. 프레임 배열이나 전체 PNG 폴더를 만들지 않는다.
- [ ] 생성 프레임 수로 0–95%를 표시하고 입력 종료 후 encoding으로 전환한다. 프로세스 성공 및 결과 파일 확인 후에만 100% completed로 바꾼다. 취소는 브라우저/인코더를 종료하고 미완성 파일만 정리한다. 서버 재실행 시 남은 임시 작업을 실패 상태로 처리한다.
- [ ] UI에 출력·진행·취소·재시도·다운로드와 도구 미설치 안내를 연결한다. download는 완료 파일 ID만 허용한다.
- [ ] 테스트 통과 후 성공 영상 1개를 직접 재생한다.
- [ ] 커밋: `feat : MP4 내보내기와 작업 취소 구현`.

## Task 7: 전체 검증과 오픈소스 사용 안내

**Files:** Create `scripts/{fixtures,verify-export}.ts`, `README.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `docs/verification.md`; Modify `package.json`, `tests/e2e/export.spec.ts`.

**Interfaces:**
- `npm run dev`, `npm run build`, `npm start`, `npm test`, `npm run test:e2e`.
- `npm run fixtures`는 직접 생성한 짧은/180초 음원, 사진, 2초 반복용 영상과 자체 가사만 Git 제외 디렉터리에 만든다.
- `npm run verify:export -- <file> <expectedDuration>`는 ffprobe로 포맷을 검사하고 실패 시 nonzero로 종료한다.

- [ ] 영상 검증기에 다음 assertion을 작성한다: `width===1920`, `height===1080`, `avg_frame_rate==='30/1'`, video codec h264, audio codec aac, pix_fmt yuv420p, `Math.abs(duration-expectedDuration)<=0.1`.
- [ ] 사진과 반복 영상 각각을 출력하는 E2E를 추가한다. 가사 경계 전후/중간/반복 경계에서 미리보기와 디코딩한 프레임의 텍스트·레이아웃·배경을 비교한다. 손실 압축 오차를 허용하며 동일 PNG 바이트를 요구하지 않는다. 원본 오디오와 출력 오디오의 정렬 오차를 측정한다.
- [ ] 테스트 실패를 확인하고 검증 스크립트를 구현한다. 출력 프레임은 직접 시각 확인하고 결과를 기록한다.
- [ ] 전체 테스트·타입 검사·production build를 한 번 통과시킨다. production 실행 상태에서 프로젝트 저장/복원과 내보내기 1회를 확인한다.
- [ ] 180초 영상 1개를 끝까지 출력한다. 부모/브라우저/FFmpeg 프로세스 RSS와 임시 디스크 사용량을 10초마다 기록해 지속적인 프레임 누적이 없는지 확인한다. 취소→재시도도 실행한다. 실패 시 해당 원인을 수정하고 영향 범위만 재검증한다.
- [ ] README에 요구 런타임·FFmpeg/Chromium 설치·실행·가사 형식·저장 위치·지원 파일·출력·문제 해결을 작성한다. 라이선스/폰트 고지와 사용자 자산 제외를 확인한다. 검증 환경·실행 명령·결과·미검증 항목을 `docs/verification.md`에 기록한다.
- [ ] 커밋: `docs : 실행 안내와 영상 검증 결과 정리`.

## 자체 검토와 실행 인계

설계의 완료 기준 1–8은 각각 Task 5, Task 1, Task 4/5, Task 2/5, Task 6/7, Task 7, Task 6/7, Task 4/5/7에서 검증한다. 작업 간 Project/LyricCue/Spectrum/SceneMedia 계약을 통일했고 Review Focus 5개 모두 담당 테스트에 배치했다. 제품 코드는 아직 작성하지 않았다.

추천 실행 방식은 이 대화에서 순서대로 직접 구현하는 Native 방식이다. 데이터 계약→분석→공통 렌더러→편집기→출력이 긴밀히 연결되어 같은 맥락에서 구현하기 적합하다. 다른 선택지는 단계별 구현/검토를 별도 에이전트에 맡기는 Subagent-driven 방식이다. 이 계획의 검토와 실행 방식 선택 이후 구현을 시작한다.

# Lyric Room에 기여하기

새로운 장면 템플릿, 오디오 시각 효과, 가사 전환, 편집 도구 개선을 환영합니다. 작은 수정은 바로 Pull Request로 보내도 됩니다. 프로젝트 형식 변경이나 새로운 의존성이 필요한 작업은 먼저 [Issue](https://github.com/minyongP/lyric-room/issues)에 목적과 사용 예시를 적어 주세요.

## 개발 환경

Node.js 22.12 이상, FFmpeg·ffprobe, Playwright Chromium이 필요합니다. 설치 방법은 [README](README.md#빠른-시작)에 있습니다.

```sh
npm ci
npx playwright install chromium
npm run fixtures
npm run dev
```

`http://127.0.0.1:4173`에서 편집합니다. Docker 실행을 확인하려면 `docker compose up -d --build`를 사용하세요. 개발 서버와 같은 포트를 사용한다면 하나를 종료하거나 README의 포트 설정을 따르세요.

브랜치는 개인 포크에서 만들고 `main`을 대상으로 PR을 보내면 됩니다. 사용자 파일은 `.local-data/`에 저장되며 Git에 포함하지 않습니다. 테스트에는 `npm run fixtures`로 생성한 자료나 직접 만든 자료를 사용해 주세요.

## 템플릿의 구성

템플릿은 **데이터 프리셋**과 **Canvas 그리기 구현**으로 나뉩니다. 시작 화면은 등록된 프리셋으로 선택 카드를 만들고, 미리보기와 MP4 출력은 같은 렌더러를 사용합니다. 현재 예시는 `classic`과 `vinyl`입니다.

| 파일 | 역할 |
| --- | --- |
| `src/shared/template-id.ts` | 저장 가능한 템플릿 ID와 타입 |
| `src/shared/templates.ts` | 이름·설명·스타일 프리셋, `applyTemplate` |
| `src/shared/project.ts` | 프로젝트·스타일의 Zod 스키마와 기본값 |
| `src/scene/templates/types.ts` | `SceneTemplate` 렌더링 계약 |
| `src/scene/templates/index.ts` | ID별 렌더러 등록 |
| `src/scene/templates/classic.ts` | 기존 가사 패널·하단 플레이어 예시 |
| `src/scene/templates/vinyl.ts` | 시간 기반 회전 커버·하향 스펙트럼 예시 |
| `src/scene/draw.ts` | 배경·가사 공통 렌더링과 템플릿 호출 |
| `src/scene/primitives.ts` | 이미지 배치·폰트·둥근 박스 등 공통 그리기 |
| `src/editor/TemplatePicker.tsx` | 선택 카드와 템플릿 변경 창 |

## 새 템플릿 추가하기

1. **ID 등록** — `template-id.ts`의 `templateIds`에 고유 ID를 추가합니다. 공개된 ID는 저장 파일에서 사용하므로 변경하거나 재사용하지 마세요.
2. **프리셋 등록** — `templates.ts`에 `id`, `name`, `description`, `style`을 추가합니다. `style`은 `defaultStyle`의 일부를 덮어쓰는 값이며 완성된 프리셋은 프로젝트 스키마를 통과해야 합니다.
3. **렌더러 작성** — `src/scene/templates/`에 `SceneTemplate` 구현을 만들고 `index.ts`에 등록합니다. `Record<TemplateId, SceneTemplate>`가 누락된 구현을 타입 검사에서 잡습니다.
4. **편집 연결** — 기존 스타일 값으로 조절할 수 있도록 우선 구성합니다. 새 옵션이 필요하면 아래의 호환성 규칙을 따라 스키마·기본값·Inspector를 함께 변경합니다.
5. **미리보기와 출력 확인** — 선택 카드는 등록된 렌더러로 자동 생성됩니다. 시작 화면 선택, 저장·다시 열기, 다른 템플릿으로 변경, 실제 MP4 출력까지 확인해 주세요.

프리셋 예시:

```ts
// 먼저 templateIds에 "my-template"를 추가한 뒤 templates에 등록합니다.
{
  id: "my-template",
  name: "나의 템플릿",
  description: "어떤 음악 장면을 만드는지 한 문장으로 설명",
  style: {
    lyricsBox: { x: 160, y: 200, w: 1600, h: 600 },
    fontSize: 48,
  },
}
```

렌더러 예시:

```ts
import type { SceneTemplate } from "./types";

export const myTemplate: SceneTemplate = {
  lyricsPanel: true,
  // 배경 다음, 가사 이전: 패널 등 가사 뒤에 놓일 요소
  drawUnderlay(ctx, project) {
    ctx.save();
    // 1920×1080 좌표계로 그립니다.
    ctx.restore();
  },
  // 가사 이후: 커버, 제목, 진행 표시, 시각 효과
  drawForeground(ctx, project, time, spectrum, media) {
    ctx.save();
    // media.cover / media.background는 이미 준비된 이미지·영상입니다.
    ctx.restore();
  },
};
```

`lyricsAnchor`와 `lyricsStep`은 가사 박스 높이 대비 현재 구절 중심과 구절 간격입니다. `hidePrevious`는 위로 이동한 이전 구절을 점차 숨깁니다. 공통 가사 검증·간주 판정은 그대로 재사용하세요.

템플릿 변경은 음악·가사·배경·커버를 유지하고 스타일 프리셋을 다시 적용합니다. 템플릿이 바뀔 때 사용자 미디어를 삭제하거나 외부로 전송하면 안 됩니다. 현재 구조는 저장소에 코드를 추가하는 방식이며, 외부 JavaScript 플러그인을 업로드해 실행하는 기능은 없습니다.

## 템플릿 안의 기술 개선하기

### 애니메이션과 재현성

- 모든 움직임은 전달받은 `time`(음원 재생 시간, 초)으로 계산합니다. `Date.now()`, 별도 타이머, 이전 프레임의 누적 회전량에 의존하지 마세요.
- 같은 프로젝트·음원 분석·시각을 입력하면 같은 프레임이 나와야 합니다. 앞으로 탐색했다가 돌아와도 결과가 같아야 합니다.
- 실제 예시는 `vinyl.ts`의 `discAngle`입니다. 재생이 멈추면 회전도 멈추며, 회전 시간 0은 정지입니다.
- 미리보기 전용 DOM 효과로 영상의 주요 요소를 구현하지 마세요. 영상에 포함할 효과는 공통 Canvas 경로에서 그립니다.

### 오디오 시각 효과

`src/audio/spectrum.ts`가 실제 음원의 32대역 분석을 제공합니다. `src/scene/visualizer.ts`의 `visualizerFrame`은 보간·스무딩·피크 감쇠를 시간 기준으로 계산합니다. 새 효과는 이를 재사용하거나 독립적인 순수 함수로 구현해 주세요.

무음, 큰 신호, 탐색, 짧은 곡에서 확인하고 박스 바깥으로 넘치지 않게 처리하세요. 막대 수를 늘리는 보간은 실제 주파수 해상도를 늘리지 않으며, 주파수 스펙트럼을 시간 파형으로 표기하지 마세요.

### 편집 옵션과 저장 호환성

- 새 스타일 필드는 Zod의 유효 범위와 `.default(...)`를 정의하고 `defaultStyle`에도 기본값을 추가합니다. 기존 프로젝트에는 새 필드가 없을 수 있습니다.
- 템플릿 정보가 없는 기존 파일은 `classic`으로 읽힙니다. 호환되지 않는 변경에는 별도 마이그레이션 설계가 필요합니다.
- 사용자에게 보이는 옵션은 Inspector에서 조절되고 실제 미리보기·출력에 반영되어야 합니다. 적용되지 않는 옵션은 숨기거나 의미를 설명하세요.
- 전체 화면은 1920×1080입니다. 요소의 배치·최대 크기·텍스트 넘침·숨김 설정을 확인하세요.
- Canvas 상태 변경은 `save()` / `restore()`로 감싸 다른 요소의 회전·투명도·클리핑에 영향을 주지 않도록 합니다.
- 미디어 로딩은 `src/scene/media.ts`에서 관리합니다. 프레임을 그릴 때 네트워크 요청이나 이미지 디코딩을 새로 시작하지 마세요.

## 검증 및 PR 작성

```sh
npm test
npm run test:e2e
npm run build
```

`npm run fixtures`를 먼저 실행해야 하며 브라우저 테스트는 독립된 4174 포트와 테스트 데이터 폴더를 사용합니다.

템플릿 관련 테스트 예시:

- `tests/shared/templates.test.ts`: 예전 저장 파일 호환, 프리셋 검증, 콘텐츠 보존, 회전 계산
- `tests/e2e/templates.spec.ts`: 시작 선택·저장·재열기·전환, 회전·탐색 재현성, 선 아래 시각 효과
- `tests/e2e/export.spec.ts`: 실제 Chromium·FFmpeg MP4 출력

PR에는 해결하려는 문제, 변경된 사용 흐름, 실행한 검증과 아직 확인하지 못한 환경을 적어 주세요. 시각적 변경에는 직접 만든 자료로 찍은 전후 화면이나 짧은 영상을 함께 제공하면 좋습니다. 의미 없는 스냅샷 갱신보다 동작과 경계 조건을 확인하는 테스트를 우선합니다.

코드는 TypeScript를 사용하며 기존 형식을 따릅니다. 수정한 파일은 Prettier로 정리해 주세요. 템플릿·옵션이 추가되면 README와 관련 가이드를 함께 갱신합니다.

## 라이선스와 자료

기여하는 코드에는 프로젝트의 [Apache License 2.0](LICENSE)이 적용됩니다. 이미지·폰트·추가 라이브러리를 포함한다면 출처와 라이선스를 확인하고 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 갱신하세요. 사용자 음원, 상용 앨범 아트, 전체 가사, 개인 프로젝트 데이터, 비밀 키를 저장소나 테스트 결과물에 포함하지 마세요.

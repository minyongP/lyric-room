import { defaultStyle, type Project, type Style } from "./project";
import type { TemplateId } from "./template-id";
export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  style: Partial<Style>;
}
export const templates: TemplateDefinition[] = [
  {
    id: "classic",
    name: "클래식 가사",
    description: "넓은 가사 패널과 하단 플레이어",
    style: {},
  },
  {
    id: "vinyl",
    name: "회전 앨범",
    description: "회전하는 원형 커버와 아래로 흐르는 스펙트럼",
    style: {
      lyricsBox: { x: 180, y: 540, w: 1560, h: 420 },
      playerBox: { x: 84, y: 24, w: 1752, h: 84 },
      visualizerBox: { x: 84, y: 350, w: 1752, h: 145 },
      panelColor: "#ffffff",
      panelOpacity: 0.1,
      panelRadius: 54,
      playerColor: "#ffffff",
      playerOpacity: 0.17,
      playerRadius: 42,
      infoSize: 32,
      fontSize: 46,
      discSize: 370,
      visualizerType: "wave",
      visualizerGlow: 0.2,
      visualizerOpacity: 1,
      showControls: false,
    },
  },
];
export function templateStyle(id: TemplateId): Style {
  const definition = templates.find((t) => t.id === id);
  if (!definition) throw Error("알 수 없는 템플릿입니다.");
  return structuredClone({ ...defaultStyle, ...definition.style });
}
/** Preserve music, assets and lyrics; only replace the scene preset. */
export function applyTemplate(project: Project, id: TemplateId): Project {
  return { ...project, templateId: id, style: templateStyle(id) };
}

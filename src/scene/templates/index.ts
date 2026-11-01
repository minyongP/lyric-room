import type { TemplateId } from "../../shared/template-id";
import type { SceneTemplate } from "./types";
import { karaoke } from "./karaoke";
import { classic } from "./classic";
import { vinyl } from "./vinyl";
export const sceneTemplates: Record<TemplateId, SceneTemplate> = {
  classic,
  vinyl,
  karaoke,
};

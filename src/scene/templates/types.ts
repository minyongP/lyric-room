import type { Project } from "../../shared/project";
import type { Spectrum } from "../../audio/spectrum";
import type { SceneMedia } from "../media";
export interface SceneTemplate {
  lyricsPanel: boolean;
  lyricsAnchor?: number;
  lyricsStep?: number;
  hidePrevious?: boolean;
  drawUnderlay?(ctx: CanvasRenderingContext2D, project: Project): void;
  drawForeground(
    ctx: CanvasRenderingContext2D,
    project: Project,
    time: number,
    spectrum: Spectrum,
    media: SceneMedia,
  ): void;
}

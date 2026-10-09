import { expect, test } from "vitest";
import { newProject, projectSchema } from "../../src/shared/project";
import {
  applyTemplate,
  templates,
  templateStyle,
} from "../../src/shared/templates";
const id = "d22abfc2-8999-4c6a-94f1-83c720389cc8";
test("legacy projects load as classic without changing existing layout", () => {
  const old = JSON.parse(JSON.stringify(newProject(id)));
  delete old.templateId;
  delete old.style.discSize;
  delete old.style.rotationSeconds;
  old.style.fontSize = 63;
  const p = projectSchema.parse(old);
  expect(p.templateId).toBe("classic");
  expect(p.style.fontSize).toBe(63);
  expect(p.style.rotationSeconds).toBe(24);
});
test("template changes preserve content and all presets validate independently", () => {
  const p = newProject(id);
  p.title = "내 음악";
  p.coverId = id;
  p.audioId = id;
  p.duration = 3;
  p.lyrics = [{ start: 0, end: 2, original: "테스트 가사" }];
  for (const t of templates) {
    const next = applyTemplate(p, t.id);
    expect(projectSchema.safeParse(next).success).toBe(true);
    expect(next.lyrics).toEqual(p.lyrics);
    expect(next.audioId).toBe(id);
    expect(next.coverId).toBe(id);
    next.style.lyricsBox.x = 0;
    expect(templateStyle(t.id).lyricsBox.x).not.toBe(0);
  }
  expect(projectSchema.safeParse({ ...p, templateId: "unknown" }).success).toBe(
    false,
  );
});

test("rotation follows playback time and can be disabled", async () => {
  const { discAngle } = await import("../../src/scene/templates/vinyl");
  expect(discAngle(6, 24)).toBeCloseTo(Math.PI / 2);
  expect(discAngle(30, 24)).toBeCloseTo(discAngle(6, 24));
  expect(discAngle(6, 0)).toBe(0);
});

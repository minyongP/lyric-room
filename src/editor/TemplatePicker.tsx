import { useEffect, useRef } from "react";
import { templates, applyTemplate } from "../shared/templates";
import { newProject } from "../shared/project";
import type { TemplateId } from "../shared/template-id";
import { drawScene } from "../scene/draw";
import { emptySpectrum } from "../audio/spectrum";
function Thumbnail({ id }: { id: TemplateId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const p = applyTemplate(
      newProject("00000000-0000-4000-8000-000000000000"),
      id,
    );
    p.title = "Your music";
    p.artist = "Your scene";
    p.duration = 180;
    p.lyrics = [
      {
        start: 0,
        end: 180,
        original: "음악이 머무는 순간",
        translation: "나만의 장면을 만들어 보세요",
      },
    ];
    const c = canvas.current!.getContext("2d")!;
    c.save();
    c.scale(384 / 1920, 216 / 1080);
    drawScene(c, p, 32, emptySpectrum, {});
    c.restore();
  }, [id]);
  return <canvas ref={canvas} width={384} height={216} aria-hidden="true" />;
}
export function TemplatePicker({
  value,
  onChange,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
}) {
  return (
    <fieldset className="template-picker">
      <legend>장면 템플릿 선택</legend>
      <div className="template-grid">
        {templates.map((t) => (
          <label
            key={t.id}
            className={`template-card ${value === t.id ? "active" : ""}`}
          >
            <input
              type="radio"
              name="scene-template"
              value={t.id}
              checked={value === t.id}
              onChange={() => onChange(t.id)}
            />
            <Thumbnail id={t.id} />
            <strong>{t.name}</strong>
            <span>{t.description}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TemplateDialog({
  value,
  onChange,
  onClose,
  onApply,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal template-modal"
      aria-label="템플릿 변경"
      onCancel={onClose}
    >
      <h2>템플릿 변경</h2>
      <p>
        음악·가사·배경·커버는 유지하고 배치와 꾸미기 설정을 선택한 템플릿의
        기본값으로 바꿉니다.
      </p>
      <TemplatePicker value={value} onChange={onChange} />
      <div className="actions">
        <button onClick={onClose}>취소</button>
        <button className="primary" onClick={onApply}>
          템플릿 적용
        </button>
      </div>
    </dialog>
  );
}

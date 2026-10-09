import { useEffect, useRef, useState } from "react";
import promptTemplate from "../../examples/ai-prompt.md?raw";
export function AiGuide({
  duration,
  onClose,
  onImport,
}: {
  duration: number;
  onClose: () => void;
  onImport: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    field = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  const prompt = `현재 음원의 전체 길이는 ${duration.toFixed(2)}초입니다. 모든 end는 이 길이를 넘기지 마세요.\n\n${promptTemplate.trim()}`;
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal ai-guide"
      aria-labelledby="ai-guide-title"
      onCancel={onClose}
    >
      <div className="guide-heading">
        <div>
          <span className="eyebrow">가사 만들기 가이드</span>
          <h2 id="ai-guide-title">AI로 타임라인 가사 만들기</h2>
        </div>
        <button aria-label="가이드 닫기" onClick={onClose}>
          닫기
        </button>
      </div>
      <p>
        오디오 파일을 직접 분석할 수 있는 AI에 MP3와 아래 요청문을 함께
        보내세요. 현재 곡 길이가 요청문에 반영됩니다.
      </p>
      <ol className="guide-steps">
        <li>
          <strong>MP3와 원문 가사 준비</strong>
          <p>
            편집 중인 MP3를 AI 대화에 직접 첨부하세요. 알고 있는 원문 가사도
            함께 주면 확인하기 좋습니다. 이 앱이 파일을 AI에 자동 전송하지는
            않습니다.
          </p>
        </li>
        <li>
          <strong>요청문 복사해서 보내기</strong>
          <p>
            외국곡·일본곡은 원문, 한글 발음, 한국어 번역을 요청합니다. 한국어
            가사는 발음·번역을 생략합니다.
          </p>
        </li>
        <li>
          <strong>결과를 가져와서 재생 확인</strong>
          <p>
            AI가 준 JSON을 ‘JSON 가져오기’에 붙여넣고 적용하세요. 재생하면서
            가사 타이밍의 시작·종료 값을 조정하세요.
          </p>
        </li>
      </ol>
      <details>
        <summary>시간과 JSON을 확인하는 방법</summary>
        <p>
          시간은 초 단위입니다. 1분 12.5초는 72.5로 적습니다. 시작은 종료보다
          빨라야 하며, 구절은 시간순으로 겹치지 않아야 합니다. 전주·간주에는
          공백을 남깁니다.
        </p>
        <p>
          앱은 형식과 시간 범위를 검사합니다. 실제 노래와 정확히 맞는지는 직접
          재생해 확인해야 합니다. AI가 음원을 들을 수 없다고 하면 시간을
          추측하게 하지 마세요.
        </p>
      </details>
      <label className="field">
        <span>AI에게 보낼 요청문</span>
        <textarea
          ref={field}
          aria-label="AI에게 보낼 요청문"
          className="guide-prompt"
          readOnly
          value={prompt}
        />
      </label>
      {message && <p role="status">{message}</p>}
      <div className="actions">
        <button onClick={onImport}>JSON 가져오기로 이동</button>
        <button
          className="primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
              setMessage("요청문을 복사했습니다. MP3와 함께 AI에게 보내세요.");
            } catch {
              field.current?.focus();
              field.current?.select();
              setMessage(
                "자동 복사가 안 됩니다. 선택된 요청문을 직접 복사해 주세요.",
              );
            }
          }}
        >
          요청문 복사
        </button>
      </div>
    </dialog>
  );
}

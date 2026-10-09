import template from "../../examples/ai-prompt.md?raw";
export const guideLanguages = [
  {
    id: "ko",
    label: "한국곡",
    description:
      "원문과 시작·종료 시간만 정리합니다. 발음·번역은 넣지 않습니다.",
    instructions:
      "한국어 곡입니다. original에는 내가 제공한 한국어 원문을 넣고, 발음과 번역 필드는 생략해줘. pronunciation과 translation을 원문과 똑같이 복제하지 마.",
  },
  {
    id: "en",
    label: "영어곡",
    description:
      "영어 원문에 실제 노래의 한글 발음과 자연스러운 한국어 번역을 더합니다.",
    instructions:
      "영어 곡입니다. original은 제공한 영어 원문을 유지해줘. pronunciation에는 실제 노래의 연음·축약·강세를 고려한 한글 발음을 넣어줘. translation에는 노래 전체 맥락과 관용 표현을 살린 자연스러운 한국어 번역을 구절별로 대응시켜줘.",
  },
  {
    id: "ja",
    label: "일본곡",
    description:
      "일본어 원문·한글 발음·한국어 번역을 만듭니다. 한자의 읽기는 음원으로 확인합니다.",
    instructions:
      "일본어 곡입니다. original은 제공한 일본어 원문을 유지해줘. 한자의 읽기는 실제 음원으로 확인하고, pronunciation에는 장음·촉음 등 실제 노래 발음에 맞춘 한글 표기를 넣어줘. translation에는 생략된 주어와 노래 전체 맥락을 고려한 자연스러운 한국어 번역을 구절별로 대응시켜줘.",
  },
  {
    id: "other",
    label: "기타",
    description:
      "다른 언어나 혼합 언어 곡에 사용합니다. 언어를 확인한 뒤 발음과 번역을 만듭니다.",
    instructions:
      "기타 언어 또는 혼합 언어 곡입니다. 제공한 가사의 언어를 먼저 확인하고, 불분명하면 나에게 물어봐. original은 제공한 원문을 유지해줘. pronunciation에는 해당 언어의 실제 노래 발음을 한글로 적고, translation에는 자연스러운 한국어 번역을 대응시켜줘. 한국어 구절에는 발음·번역을 생략하고, 혼합 언어는 구절별로 처리해줘.",
  },
] as const;
export type GuideLanguage = (typeof guideLanguages)[number]["id"];
export function buildAiPrompt(language: GuideLanguage, duration: number) {
  const item = guideLanguages.find((x) => x.id === language)!;
  const example = {
    schemaVersion: 1,
    lyrics: [
      {
        start: 0.5,
        end: 1,
        original: "제공한 원문 구절",
        ...(language === "ko"
          ? {}
          : {
              pronunciation: "원문의 한글 발음",
              translation: "원문의 한국어 번역",
            }),
      },
    ],
  };
  return template
    .replace("{{duration}}", duration.toFixed(2))
    .replace("{{language}}", item.instructions)
    .replace("{{example}}", JSON.stringify(example, null, 2))
    .trim();
}

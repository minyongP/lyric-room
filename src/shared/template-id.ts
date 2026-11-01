export const templateIds = ["classic", "vinyl", "karaoke"] as const;
export type TemplateId = (typeof templateIds)[number];

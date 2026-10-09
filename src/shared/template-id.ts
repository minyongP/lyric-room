export const templateIds = ["classic", "vinyl"] as const;
export type TemplateId = (typeof templateIds)[number];

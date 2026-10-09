import { test, expect, vi, afterEach } from "vitest";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
test("renews an expired server session without losing the save payload", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ token: "before" }))
    .mockResolvedValueOnce(
      Response.json(
        { error: "세션이 만료되었습니다. 새로고침해 주세요." },
        { status: 403 },
      ),
    )
    .mockResolvedValueOnce(Response.json({ token: "after" }))
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  const { api } = await import("../../src/editor/api");
  await expect(
    api("/projects/p", { method: "PUT", body: '{"title":"saved"}' }),
  ).resolves.toEqual({ ok: true });
  expect(fetch.mock.calls[3][1].body).toBe('{"title":"saved"}');
  expect(fetch.mock.calls[3][1].headers.get("X-Session-Token")).toBe("after");
});
test("does not retry forbidden origin requests", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ token: "t" }))
    .mockResolvedValueOnce(
      Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 }),
    );
  vi.stubGlobal("fetch", fetch);
  const { api } = await import("../../src/editor/api");
  await expect(api("/projects", { method: "POST" })).rejects.toThrow(
    "허용되지",
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});

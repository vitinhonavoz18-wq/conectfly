import { describe, expect, it } from "vitest";
import {
  classifyMetaResponse,
  buildContainerRequest,
  buildCarouselRequest,
  decideResultPoll,
} from "../src/index.ts";
import {
  computeBackoffMs,
  withRetry,
  PermanentError,
  RetryableError,
  parseRetryAfter,
  redact,
} from "@lc/shared";
import { fixture } from "./helpers.ts";

const opts = (
  operation: Parameters<typeof classifyMetaResponse>[1]["operation"],
  attempt = 1,
  maxAttempts = 4,
) => ({ operation, attempt, maxAttempts, random: () => 0.5 });

describe("classifyMetaResponse", () => {
  it("container criado / publicado", () => {
    expect(
      classifyMetaResponse(
        { status_code: 200, body: fixture("meta/container-created.json") },
        opts("create_container"),
      ),
    ).toMatchObject({ outcome: "success", data: { container_id: "17900000000000001" } });
    expect(
      classifyMetaResponse(
        { status_code: 200, body: fixture("meta/media-published.json") },
        opts("media_publish"),
      ),
    ).toMatchObject({ outcome: "success", data: { media_id: "17800000000000009" } });
  });
  it("status do container: IN_PROGRESS espera, FINISHED pronto, ERROR/EXPIRED falham", () => {
    expect(
      classifyMetaResponse(
        { status_code: 200, body: fixture("meta/container-in-progress.json") },
        opts("container_status"),
      ).outcome,
    ).toBe("wait");
    expect(
      classifyMetaResponse(
        { status_code: 200, body: fixture("meta/container-finished.json") },
        opts("container_status"),
      ).outcome,
    ).toBe("ready");
    expect(
      classifyMetaResponse(
        { status_code: 200, body: fixture("meta/container-error.json") },
        opts("container_status"),
      ),
    ).toMatchObject({ outcome: "fail", error_code: "CONTAINER_ERROR" });
    expect(
      classifyMetaResponse(
        { status_code: 200, body: fixture("meta/container-expired.json") },
        opts("container_status"),
      ),
    ).toMatchObject({ outcome: "fail", error_code: "CONTAINER_EXPIRED" });
    expect(
      classifyMetaResponse(
        { status_code: 200, body: fixture("meta/container-published.json") },
        opts("container_status"),
      ).outcome,
    ).toBe("already_published");
  });
  it("container que nunca termina → CONTAINER_TIMEOUT (sem media_publish)", () => {
    expect(
      classifyMetaResponse(
        { status_code: 200, body: fixture("meta/container-in-progress.json") },
        opts("container_status", 10, 10),
      ),
    ).toMatchObject({ outcome: "fail", error_code: "CONTAINER_TIMEOUT" });
  });
  it("429 / limite de taxa → retry com backoff, depois falha", () => {
    const r = classifyMetaResponse(
      { status_code: 400, body: fixture("meta/error-rate-limit.json") },
      opts("media_publish"),
    );
    expect(r).toMatchObject({ outcome: "retry", error_code: "RATE_LIMITED", delay_seconds: 30 });
    expect(
      classifyMetaResponse({ status_code: 429, body: {} }, opts("media_publish", 2)).delay_seconds,
    ).toBe(60);
    expect(
      classifyMetaResponse({ status_code: 429, body: {} }, opts("media_publish", 4, 4)),
    ).toMatchObject({ outcome: "fail", error_code: "RATE_LIMITED_MAX_ATTEMPTS" });
  });
  it("respeita Retry-After", () => {
    expect(
      classifyMetaResponse(
        { status_code: 429, body: {}, headers: { "retry-after": "7" } },
        opts("media_publish"),
      ).delay_seconds,
    ).toBe(7);
  });
  it("token inválido / permissão / parâmetro → falha permanente sem retry", () => {
    expect(
      classifyMetaResponse(
        { status_code: 400, body: fixture("meta/error-invalid-token.json") },
        opts("create_container"),
      ),
    ).toMatchObject({ outcome: "fail", permanent: true, error_code: "TOKEN_INVALID" });
    expect(
      classifyMetaResponse(
        { status_code: 403, body: fixture("meta/error-permission.json") },
        opts("create_container"),
      ),
    ).toMatchObject({ outcome: "fail", permanent: true, error_code: "PERMISSION_DENIED" });
    expect(
      classifyMetaResponse(
        { status_code: 400, body: fixture("meta/error-invalid-parameter.json") },
        opts("create_container"),
      ),
    ).toMatchObject({ outcome: "fail", permanent: true });
  });
  it("5xx, rede e mídia não pronta → retry", () => {
    expect(
      classifyMetaResponse(
        { status_code: 500, body: fixture("meta/error-server.json") },
        opts("media_publish"),
      ).outcome,
    ).toBe("retry");
    expect(
      classifyMetaResponse({ status_code: 0, error: "ECONNRESET" }, opts("media_publish")).outcome,
    ).toBe("retry");
    expect(
      classifyMetaResponse(
        { status_code: 400, body: fixture("meta/error-media-not-ready.json") },
        opts("media_publish"),
      ),
    ).toMatchObject({ outcome: "retry", error_code: "MEDIA_NOT_READY" });
  });
  it("HTTP 200 com corpo inesperado NÃO é sucesso", () => {
    expect(
      classifyMetaResponse({ status_code: 200, body: {} }, opts("media_publish")),
    ).toMatchObject({ outcome: "fail", error_code: "INVALID_RESPONSE" });
    expect(
      classifyMetaResponse(
        { status_code: 200, body: { status_code: "WEIRD" } },
        opts("container_status"),
      ),
    ).toMatchObject({ outcome: "fail", error_code: "INVALID_RESPONSE" });
  });
  it("monta corpo do container por tipo de mídia", () => {
    expect(
      buildContainerRequest({ media_type: "IMAGE", media_url: "https://x/a.jpg", caption: "c" }),
    ).toEqual({ image_url: "https://x/a.jpg", caption: "c" });
    expect(
      buildContainerRequest({ media_type: "REELS", media_url: "https://x/a.mp4", caption: "c" }),
    ).toMatchObject({ media_type: "REELS", video_url: "https://x/a.mp4" });
    expect(
      buildContainerRequest({ media_type: "STORIES", media_url: "https://x/a.jpg" }),
    ).toMatchObject({ media_type: "STORIES" });
    expect(buildCarouselRequest(["1", "2"], "c")).toEqual({
      media_type: "CAROUSEL",
      children: "1,2",
      caption: "c",
    });
    expect(() =>
      buildContainerRequest({ media_type: "IMAGE", media_url: "file:///etc/passwd" }),
    ).toThrow();
    expect(() => buildCarouselRequest(["1"], "c")).toThrow();
  });
});

describe("retry/backoff", () => {
  const policy = { baseMs: 5000, factor: 3, maxMs: 120000, jitterRatio: 0 };
  it("sequência 5s, 15s, 45s, 120s (teto)", () => {
    expect([1, 2, 3, 4, 5].map((a) => computeBackoffMs(a, policy))).toEqual([
      5000, 15000, 45000, 120000, 120000,
    ]);
  });
  it("jitter fica dentro de ±20%", () => {
    const min = computeBackoffMs(2, { ...policy, jitterRatio: 0.2 }, () => 0);
    const max = computeBackoffMs(2, { ...policy, jitterRatio: 0.2 }, () => 0.9999999);
    expect(min).toBe(12000);
    expect(max).toBeLessThanOrEqual(18000);
  });
  it("withRetry repete erros transitórios e para nos permanentes", async () => {
    let calls = 0;
    const ok = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new RetryableError("tmp");
        return "ok";
      },
      { sleep: async () => {} },
    );
    expect(ok).toBe("ok");
    expect(calls).toBe(3);
    calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new PermanentError("token inválido");
        },
        { sleep: async () => {} },
      ),
    ).rejects.toThrow("token inválido");
    expect(calls).toBe(1);
  });
  it("withRetry não entra em loop infinito", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new RetryableError("sempre falha");
        },
        { sleep: async () => {}, policy: { maxAttempts: 4 } },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(4);
  });
  it("parseRetryAfter", () => {
    expect(parseRetryAfter("10")).toBe(10000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(
      parseRetryAfter("Wed, 21 Oct 2015 07:28:10 GMT", Date.parse("Wed, 21 Oct 2015 07:28:00 GMT")),
    ).toBe(10000);
  });
  it("polling de resultado: backoff limitado e parada garantida", () => {
    expect(
      decideResultPoll({ attempt: 1, maxAttempts: 10, intervalSeconds: 180, random: () => 0.5 }),
    ).toMatchObject({ outcome: "retry", delay_seconds: 180 });
    expect(
      decideResultPoll({ attempt: 9, maxAttempts: 10, intervalSeconds: 180, random: () => 0.5 })
        .delay_seconds,
    ).toBe(720);
    expect(decideResultPoll({ attempt: 10, maxAttempts: 10, intervalSeconds: 180 }).outcome).toBe(
      "stop",
    );
  });
});

// Chaves falsas montadas em tempo de execução (para o scanner de segredos não dar alarme falso).
const FAKE_OPENAI_KEY = ["sk", "abcdefghijklmnopqrstuvwxyz"].join("-");

describe("redact (nunca logar segredo)", () => {
  it("mascara chaves e valores sensíveis", () => {
    const out = redact({
      access_token: "EAAabc",
      nested: {
        Authorization: "Bearer abcdefghijkl",
        url: "https://graph/x?access_token=EAAsecret123&fields=id",
      },
      note: `chave ${FAKE_OPENAI_KEY}`,
      db: "postgres://user:senha123@host/db",
      idempotency_key: "result:megasena:1:feed",
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain("EAAabc");
    expect(text).not.toContain("EAAsecret123");
    expect(text).not.toContain('abcdefghijkl"');
    expect(text).not.toContain(FAKE_OPENAI_KEY);
    expect(text).not.toContain("senha123");
    expect(out.idempotency_key).toBe("result:megasena:1:feed");
  });
});

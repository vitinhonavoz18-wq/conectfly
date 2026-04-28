/**
 * Push do projeto completo para um repositório GitHub do usuário.
 * Usa um Personal Access Token (PAT) fornecido em tempo real — nada é persistido.
 *
 * Fluxo: lê/cria repo → pega SHA do branch default → cria blobs de cada arquivo →
 * cria uma tree → cria um commit → atualiza a ref do branch.
 */

import JSZip from "jszip";
import type { SiteData } from "./types";
import { buildProjectZip } from "./exportZip";

const API = "https://api.github.com";

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function gh<T = unknown>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      ...(init?.headers ?? {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    let msg = `GitHub ${res.status}`;
    try {
      const j = await res.json();
      msg += `: ${j.message ?? JSON.stringify(j)}`;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

interface GhUser { login: string }
interface GhRepo { full_name: string; default_branch: string; html_url: string; clone_url: string }
interface GhRef { object: { sha: string } }
interface GhCommit { sha: string; tree: { sha: string } }
interface GhBlob { sha: string }
interface GhTree { sha: string }
interface GhNewCommit { sha: string }

// Encoda uma Uint8Array em base64 (compatível com browser).
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

export interface PushOptions {
  token: string;
  repoName: string;
  isPrivate: boolean;
  commitMessage?: string;
  onProgress?: (msg: string) => void;
}

export interface PushResult {
  repoUrl: string;
  branch: string;
  filesCount: number;
}

export async function pushProjectToGithub(
  data: SiteData,
  opts: PushOptions,
): Promise<PushResult> {
  const { token, repoName, isPrivate, onProgress } = opts;
  const progress = (m: string) => onProgress?.(m);

  progress("Verificando token...");
  const me = await gh<GhUser>(token, "/user");

  progress(`Conectado como @${me.login}. Localizando repositório...`);
  let repo: GhRepo;
  try {
    repo = await gh<GhRepo>(token, `/repos/${me.login}/${repoName}`);
  } catch {
    progress(`Criando repositório ${repoName}...`);
    repo = await gh<GhRepo>(token, "/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: repoName,
        private: isPrivate,
        auto_init: true,
        description: `Site de delivery gerado pela plataforma — ${data.restaurant.name}`,
      }),
    });
    // Pequena espera para o GitHub provisionar o branch inicial
    await new Promise((r) => setTimeout(r, 1200));
  }

  const branch = repo.default_branch || "main";
  progress(`Gerando arquivos do projeto...`);
  const blob = await buildProjectZip(data);
  const zip = await JSZip.loadAsync(blob);

  const entries: { path: string; bytes: Uint8Array }[] = [];
  const promises: Promise<void>[] = [];
  zip.forEach((relPath, file) => {
    if (file.dir) return;
    // O exportZip empacota com prefixo rootName/. Removemos esse prefixo
    // para que os arquivos fiquem na raiz do repositório.
    const firstSlash = relPath.indexOf("/");
    const path = firstSlash >= 0 ? relPath.slice(firstSlash + 1) : relPath;
    if (!path) return;
    promises.push(
      file.async("uint8array").then((bytes) => {
        entries.push({ path, bytes });
      }),
    );
  });
  await Promise.all(promises);
  progress(`Preparando ${entries.length} arquivos para envio...`);

  // Pega o SHA atual do branch
  let baseRef: GhRef;
  try {
    baseRef = await gh<GhRef>(
      token,
      `/repos/${repo.full_name}/git/ref/heads/${branch}`,
    );
  } catch (e) {
    throw new Error(
      `Não foi possível ler o branch "${branch}". ${e instanceof Error ? e.message : ""}`,
    );
  }
  const baseCommit = await gh<GhCommit>(
    token,
    `/repos/${repo.full_name}/git/commits/${baseRef.object.sha}`,
  );

  // Cria um blob para cada arquivo (em paralelo, em lotes).
  progress("Enviando arquivos para o GitHub...");
  const blobs: { path: string; sha: string }[] = [];
  const BATCH = 6;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    const out = await Promise.all(
      slice.map(async (e) => {
        const b = await gh<GhBlob>(
          token,
          `/repos/${repo.full_name}/git/blobs`,
          {
            method: "POST",
            body: JSON.stringify({
              content: toBase64(e.bytes),
              encoding: "base64",
            }),
          },
        );
        return { path: e.path, sha: b.sha };
      }),
    );
    blobs.push(...out);
    progress(`Enviados ${blobs.length}/${entries.length} arquivos...`);
  }

  // Cria uma tree nova (substitui tudo — base_tree omitido).
  progress("Montando commit...");
  const newTree = await gh<GhTree>(
    token,
    `/repos/${repo.full_name}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({
        tree: blobs.map((b) => ({
          path: b.path,
          mode: "100644",
          type: "blob",
          sha: b.sha,
        })),
      }),
    },
  );

  const newCommit = await gh<GhNewCommit>(
    token,
    `/repos/${repo.full_name}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: opts.commitMessage || `chore: update site (${new Date().toISOString()})`,
        tree: newTree.sha,
        parents: [baseCommit.sha],
      }),
    },
  );

  // Atualiza a ref do branch.
  await gh(token, `/repos/${repo.full_name}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });

  progress("Concluído!");
  return {
    repoUrl: repo.html_url,
    branch,
    filesCount: entries.length,
  };
}

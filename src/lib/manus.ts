import { optionalEnv, requireEnv } from "./env.js";

const MANUS_BASE = "https://api.manus.ai/v2";

export interface ManusSiteInput {
  name: string;
  full_address: string;
  niche: string;
}

function manusHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-manus-api-key": requireEnv("MANUS_API_KEY"),
  };
}

function buildManusPrompt(input: ManusSiteInput): string {
  return `Build a single-page marketing website for a local London business.

Business name: ${input.name}
Address: ${input.full_address}
Category: ${input.niche}

Requirements:
- Professional, mobile-first design
- Hero, services, and contact sections
- British English copy (no lorem ipsum)
- Publish the website when complete`;
}

async function manusRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${MANUS_BASE}${path}`, {
    method,
    headers: manusHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Manus API error ${response.status} on ${path}: ${text}`);
  }

  return response.json() as Promise<T>;
}

async function createWebsiteTask(input: ManusSiteInput): Promise<string> {
  const profile = optionalEnv("MANUS_AGENT_PROFILE") ?? "manus-1.6-lite";

  const result = await manusRequest<{ task_id: string; task_url?: string }>(
    "POST",
    "/task.create",
    {
      message: { content: buildManusPrompt(input) },
      agent_profile: profile,
      hide_in_task_list: true,
      title: `Site: ${input.name}`,
    },
  );

  if (!result.task_id) {
    throw new Error("Manus task.create did not return task_id");
  }

  return result.task_id;
}

async function pollTaskUntilDone(
  taskId: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const maxAttempts = 120;
  const pollMs = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    const result = await manusRequest<{
      agent_status?: string;
      waiting_for_event_type?: string;
      events?: Array<Record<string, unknown>>;
    }>("GET", `/task.listMessages?task_id=${encodeURIComponent(taskId)}`);

    const status = result.agent_status ?? "running";
    onProgress?.(`Manus task status: ${status}\n`);

    if (status === "waiting") {
      const eventType = result.waiting_for_event_type;
      if (eventType === "messageAskUser") {
        await manusRequest("POST", "/task.sendMessage", {
          task_id: taskId,
          message: { content: "Yes, proceed and publish the website." },
        });
      } else {
        await manusRequest("POST", "/task.confirmAction", {
          task_id: taskId,
          action: "confirm",
        });
      }
      await sleep(pollMs);
      continue;
    }

    if (status === "stopped") return;
    if (status === "error") {
      throw new Error("Manus task failed — check task in Manus dashboard");
    }

    await sleep(pollMs);
  }

  throw new Error("Manus task timed out waiting for completion");
}

async function publishAndGetUrl(taskId: string): Promise<string> {
  const publish = await manusRequest<{
    ok?: boolean;
    website_id?: string;
  }>("POST", "/website.publish", { task_id: taskId });

  const websiteId = publish.website_id;

  for (let i = 0; i < 60; i++) {
    const query = websiteId
      ? `website_id=${encodeURIComponent(websiteId)}`
      : `task_id=${encodeURIComponent(taskId)}`;

    const status = await manusRequest<{
      publish_status?: string;
      site_urls?: string[];
    }>("GET", `/website.status?${query}`);

    if (status.publish_status === "published" && status.site_urls?.[0]) {
      return status.site_urls[0];
    }
    if (status.publish_status === "failed") {
      throw new Error("Manus website publish failed");
    }

    await sleep(3000);
  }

  throw new Error("Manus website publish timed out");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function buildSiteWithManus(
  input: ManusSiteInput,
  onProgress?: (msg: string) => void,
): Promise<string> {
  onProgress?.(`Creating Manus task for ${input.name}...\n`);
  const taskId = await createWebsiteTask(input);
  onProgress?.(`Manus task: ${taskId}\n`);

  await pollTaskUntilDone(taskId, onProgress);
  onProgress?.("Publishing website on Manus...\n");

  const url = await publishAndGetUrl(taskId);
  onProgress?.(`Live at ${url}\n`);
  return url;
}

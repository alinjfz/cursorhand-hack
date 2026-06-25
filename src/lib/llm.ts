import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { optionalEnv } from "./env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, "../../prompts/site-generation.md");

export interface SiteGenerationInput {
  name: string;
  full_address: string;
  niche: string;
}

function loadPromptTemplate(): string {
  return readFileSync(PROMPT_PATH, "utf-8");
}

function fillPrompt(input: SiteGenerationInput): string {
  const year = new Date().getFullYear().toString();
  return loadPromptTemplate()
    .replace(/\{\{name\}\}/g, input.name)
    .replace(/\{\{full_address\}\}/g, input.full_address)
    .replace(/\{\{niche\}\}/g, input.niche)
    .replace(/\{\{year\}\}/g, year);
}

function stripMarkdownFences(html: string): string {
  const trimmed = html.trim();
  const fenceMatch = trimmed.match(/^```(?:html)?\s*([\s\S]*?)```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

async function generateWithAnthropic(prompt: string): Promise<string> {
  const apiKey = optionalEnv("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = json.content.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no text content");
  return stripMarkdownFences(text);
}

async function generateWithOpenAI(prompt: string): Promise<string> {
  const apiKey = optionalEnv("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = json.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned no text content");
  return stripMarkdownFences(text);
}

export async function generateSiteHtml(
  input: SiteGenerationInput,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const prompt = fillPrompt(input);
  onChunk?.(`Generating site for ${input.name}...\n`);

  const useAnthropic = Boolean(optionalEnv("ANTHROPIC_API_KEY"));
  const useOpenAI = Boolean(optionalEnv("OPENAI_API_KEY"));

  if (!useAnthropic && !useOpenAI) {
    throw new Error("Set ANTHROPIC_API_KEY or OPENAI_API_KEY");
  }

  const html = useAnthropic
    ? await generateWithAnthropic(prompt)
    : await generateWithOpenAI(prompt);

  onChunk?.(`Generated ${html.length} bytes of HTML\n`);
  return html;
}

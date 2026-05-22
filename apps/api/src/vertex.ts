import { createSign } from "node:crypto";
import fs from "node:fs";
import { config } from "./config.js";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
  token_uri?: string;
};

let serviceAccount: ServiceAccount | null = null;
let accessToken: { token: string; expiresAt: number } | null = null;

export async function vertexGenerateContent(prompt: string, options?: { responseMimeType?: string; temperature?: number }) {
  const accessToken = await getAccessToken();
  const url = vertexModelUrl(config.geminiChatModel, "generateContent");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.1,
        ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Vertex Gemini generateContent failed: ${response.status} ${detail}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

export async function vertexEmbedText(text: string, taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" = "RETRIEVAL_QUERY") {
  const accessToken = await getAccessToken();
  const response = await fetch(vertexModelUrl(config.geminiEmbeddingModel, "predict"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ content: text, task_type: taskType }],
      parameters: {
        autoTruncate: true,
        outputDimensionality: config.geminiEmbeddingDimensions,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Vertex Gemini embedding failed: ${response.status} ${detail}`);
  }

  const data = (await response.json()) as {
    predictions?: Array<{ embeddings?: { values?: number[] } }>;
  };
  const values = data.predictions?.[0]?.embeddings?.values;
  if (!values?.length) throw new Error("Vertex Gemini embedding returned no values");
  return values;
}

export function getVertexProjectId() {
  const account = loadServiceAccount();
  return config.googleCloudProject || account.project_id;
}

function vertexModelUrl(model: string, method: "generateContent" | "predict") {
  const projectId = getVertexProjectId();
  if (!projectId) throw new Error("Missing Google Cloud project id for Vertex AI");
  return `https://${config.vertexLocation}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${config.vertexLocation}/publishers/google/models/${model}:${method}`;
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (accessToken && accessToken.expiresAt - 60 > now) return accessToken.token;

  const account = loadServiceAccount();
  const tokenUri = account.token_uri ?? "https://oauth2.googleapis.com/token";
  const assertion = signJwt({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }, account.private_key);

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google OAuth token exchange failed: ${response.status} ${detail}`);
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Google OAuth token exchange returned no access token");

  accessToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600),
  };
  return accessToken.token;
}

function loadServiceAccount() {
  if (serviceAccount) return serviceAccount;

  const raw =
    config.googleServiceAccountJson ||
    (config.googleServiceAccountJsonBase64 ? Buffer.from(config.googleServiceAccountJsonBase64, "base64").toString("utf8") : "") ||
    (config.googleApplicationCredentials && fs.existsSync(config.googleApplicationCredentials) ? fs.readFileSync(config.googleApplicationCredentials, "utf8") : "");

  if (!raw) {
    throw new Error("Missing Vertex service account. Set GOOGLE_APPLICATION_CREDENTIALS locally or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 on Render.");
  }

  serviceAccount = JSON.parse(raw) as ServiceAccount;
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Invalid Vertex service account JSON");
  }
  return serviceAccount;
}

function signJwt(payload: Record<string, unknown>, privateKey: string) {
  const header = { alg: "RS256", typ: "JWT" };
  const input = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(input).end().sign(privateKey);
  return `${input}.${base64Url(signature)}`;
}

function base64Url(value: string | Buffer) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

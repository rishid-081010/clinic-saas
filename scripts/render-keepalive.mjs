const url = process.env.KEEPALIVE_URL || process.env.APP_URL;

if (!url) {
  console.error("Set KEEPALIVE_URL to your Render web service URL.");
  process.exit(1);
}

const target = `${url.replace(/\/$/, "")}/health`;
const response = await fetch(target);

if (!response.ok) {
  console.error(`Keepalive failed: ${response.status} ${await response.text()}`);
  process.exit(1);
}

console.log(`Keepalive OK: ${target}`);

import { readFileSync } from "fs";
import { resolve } from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_ID = "0bcd701b-212d-4482-b611-d1e2cccd6198";
const BASE = "https://mpfaraujo.com.br/guardafiguras/api/questoes";
const GF = "https://mpfaraujo.com.br/guardafiguras/uploads/";

const URL_MAP = {
  "177-enem-2023-um-controlador-de-voo": GF + "3d19c3aeafb87f0fa960b4ea4eda8cc6d5b89adda60993098508f7a285ff129.webp",
  "146-enem-2022-uma-pessoa-precisa-contratar-um-operario": GF + "54861475cf4af1298943bf36c1777518a1b1b830867662ff11def54081211f58.webp",
  "168-enem-2022-uma-instituicao-de-ensino-superior": GF + "42c0c0f65077759e1e18280d65160e22ae65da31afdc6a3066218775ecc8a63e.webp",
  "161-enem-ppl-2021": GF + "1b0ec29009f989bb6bdb6858de936f06fd1d867671a1823477563d2c0b56a4ac.webp",
  "148-enem-ppl-2021-os-pneus": GF + "4298ac27923c32eb2dbb992acafebdbd44c5b970be82d6e0cdb06d98f6b243c5.webp",
  "136-enem-ppl-2021-na-loteria-lotex": GF + "bc05858addfd66db71acc932759d1f889e46e74dfb345f3395ff4c172930475f.webp",
  "179-enem-2021-um-segmento-de-reta": GF + "c7a867afb830daaf6469540a718d024603e452bc580a89f69fc5421798a5e10d.webp",
};

function getToken() {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const m = env.match(/QUESTIONS_TOKEN=(.+)/);
  if (!m) throw new Error("QUESTIONS_TOKEN não encontrado");
  return m[1].trim();
}

function findNewUrl(oldUrl) {
  for (const [fragment, newUrl] of Object.entries(URL_MAP)) {
    if (oldUrl.includes(fragment)) return newUrl;
  }
  return null;
}

async function main() {
  const token = getToken();
  const headers = { "X-Questions-Token": token, "Content-Type": "application/json" };

  if (DRY_RUN) console.log("[DRY RUN]\n");

  const r = await fetch(BASE + "/list.php?limit=100&page=1", { headers });
  const d = await r.json();
  const batchItems = (d.items || []).filter(q => q.metadata?.import_run_id === BATCH_ID);
  console.log("Itens do batch:", batchItems.length);

  let fixed = 0;
  for (const q of batchItems) {
    const r2 = await fetch(BASE + "/get.php?id=" + q.id, { headers });
    const full = await r2.json();
    const item = full.item || full;
    const contentStr = JSON.stringify(item.content);

    if (!contentStr.includes("projetoagathaedu")) continue;

    // extrai URLs externas
    const PATTERN = /https?:\/\/projetoagathaedu\.com\.br\/[^"\\]+/g;
    const externalUrls = contentStr.match(PATTERN) || [];
    const replacements = {};
    for (const oldUrl of externalUrls) {
      const newUrl = findNewUrl(oldUrl);
      if (newUrl) replacements[oldUrl] = newUrl;
      else console.warn("  Sem mapeamento:", oldUrl);
    }

    if (Object.keys(replacements).length === 0) continue;

    let updated = contentStr;
    for (const [oldUrl, newUrl] of Object.entries(replacements)) {
      updated = updated.split(oldUrl).join(newUrl);
    }
    const content = JSON.parse(updated);
    const metadata = item.metadata;

    console.log("Questão:", q.id);
    for (const [old, nw] of Object.entries(replacements)) {
      console.log("  " + old.split("/").pop());
      console.log("  → " + nw.split("/").pop());
    }

    if (!DRY_RUN) {
      const pr = await fetch(BASE + "/propose.php", {
        method: "POST",
        headers,
        body: JSON.stringify({ questionId: q.id, metadata, content }),
      });
      const res = await pr.json();
      if (res.success || res.ok) {
        console.log("  ✓ Atualizada");
        fixed++;
      } else {
        console.error("  ✗ Erro:", JSON.stringify(res));
      }
    } else {
      fixed++;
    }
  }

  console.log("\nTotal corrigidas:", fixed);
}

main().catch(e => { console.error(e); process.exit(1); });

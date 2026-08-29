/**
 * Prisma types money columns as Decimal, but this app hydrates them to JS
 * numbers in src/lib/prisma.ts. Rewrite the generated Decimal alias so TS
 * matches runtime. Re-run after every `prisma generate`.
 */
const fs = require("fs");
const path = require("path");

const files = [
  path.join(__dirname, "..", "node_modules", ".prisma", "client", "index.d.ts"),
  path.join(__dirname, "..", "node_modules", ".prisma", "client", "edge.d.ts"),
];

const FROM = "export import Decimal = runtime.Decimal";
const TO = "export type Decimal = number";

let patched = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes(FROM)) {
    if (src.includes(TO)) {
      console.log(`already patched: ${path.relative(process.cwd(), file)}`);
      continue;
    }
    console.warn(`Decimal alias not found in ${file}`);
    continue;
  }
  fs.writeFileSync(file, src.replace(FROM, TO));
  patched += 1;
  console.log(`patched Decimal -> number: ${path.relative(process.cwd(), file)}`);
}

if (patched === 0 && !files.some((f) => fs.existsSync(f))) {
  console.warn("Prisma client types not found; skip Decimal patch.");
}

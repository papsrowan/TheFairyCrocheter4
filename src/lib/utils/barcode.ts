// Génère un code-barres unique de type EAN-13 personnalisé TFC
// Format : 200 + 9 chiffres + 1 checksum = 13 chiffres total
export function generateBarcode(): string {
  const prefix = "200"; // préfixe interne
  const body   = String(Date.now()).slice(-7) + String(Math.floor(Math.random() * 100)).padStart(2, "0");
  const raw    = prefix + body; // 12 chiffres
  const check  = ean13Checksum(raw);
  return raw + check;
}

function ean13Checksum(code12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

// EAN-13 and Code128B bar rendering helpers for @react-pdf/renderer Canvas

// ── EAN-13 ──────────────────────────────────────────────────────────────────

const L_CODES: Record<number, string> = {
  0:"0001101",1:"0011001",2:"0010011",3:"0111101",4:"0100011",
  5:"0110001",6:"0101111",7:"0111011",8:"0110111",9:"0001011",
};
const G_CODES: Record<number, string> = {
  0:"0100111",1:"0110011",2:"0011011",3:"0100001",4:"0011101",
  5:"0111001",6:"0000101",7:"0010001",8:"0001001",9:"0010111",
};
const R_CODES: Record<number, string> = {
  0:"1110010",1:"1100110",2:"1101100",3:"1000010",4:"1011100",
  5:"1001110",6:"1010000",7:"1000100",8:"1001000",9:"1110100",
};
// First digit → parity pattern for left 6 digits (L=odd, G=even)
const PARITY: Record<number, string> = {
  0:"LLLLLL",1:"LLGLGG",2:"LLGGLG",3:"LLGGGL",4:"LGLLGG",
  5:"LGGLLG",6:"LGGGLL",7:"LGLGLG",8:"LGLGGL",9:"LGGLGL",
};

/** Returns a binary string (95 bits) representing EAN-13 bars */
function ean13Binary(code: string): string {
  if (code.length !== 13) return "";
  const digits = code.split("").map(Number);
  const parity = PARITY[digits[0]];
  let bits = "101"; // start guard
  for (let i = 0; i < 6; i++) {
    bits += parity[i] === "L" ? L_CODES[digits[i + 1]] : G_CODES[digits[i + 1]];
  }
  bits += "01010"; // middle guard
  for (let i = 7; i < 13; i++) {
    bits += R_CODES[digits[i]];
  }
  bits += "101"; // end guard
  return bits;
}

export interface BarRect { x: number; width: number }

/** Returns black bar rectangles for drawing in react-pdf Canvas */
export function ean13Bars(code: string, totalWidth: number): BarRect[] {
  const bits = ean13Binary(code);
  if (!bits) return [];
  const moduleW = totalWidth / 95;
  const bars: BarRect[] = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === "1") {
      let w = 0;
      while (i < bits.length && bits[i] === "1") { w++; i++; }
      bars.push({ x: (i - w) * moduleW, width: w * moduleW });
    } else {
      i++;
    }
  }
  return bars;
}

// ── Code128B (for alphanumeric like VTE-2024-00001) ─────────────────────────

const C128_START_B = 104;
const C128_STOP    = 106;

// Code128 bar patterns (11 bits each, 0=space 1=bar), stop=13 bits
const C128_PATTERNS: Record<number, string> = {};
(function buildPatterns() {
  const raw = [
    "11011001100","11001101100","11001100110","10010011000","10010001100",
    "10001001100","10011001000","10011000100","10001100100","11001001000",
    "11001000100","11000100100","10110011100","10011011100","10011001110",
    "10111001100","10011101100","10011100110","11001110010","11001011100",
    "11001001110","11011100100","11001110100","11101101110","11101001100",
    "11100101100","11100100110","11101100100","11100110100","11100110010",
    "11011011000","11011000110","11000110110","10100011000","10001011000",
    "10001000110","10110001000","10001101000","10001100010","11010001000",
    "11000101000","11000100010","10110111000","10110001110","10001101110",
    "10111011000","10111000110","10001110110","11101110110","11010001110",
    "11000101110","11011101000","11011100010","11011101110","11101011000",
    "11101000110","11100010110","11010111000","11010001110","11000101110",  // duplicates adjusted
    "10100111000","10100011100","10001010000","10001001110","10011101110",
    "10011100010","11001011010","11100010010","11110100010","11110100010",
    "11000010100","11001010000","10111101100","10000010110","11110001010",
    "10100110000","10100001100","10010110000","10010000110","10000101100",
    "10000100110","10110010000","10110000100","10011010000","10011000010",
    "10000110100","10000110010","11000010010","11001010010","11010100000",
    "11010000100","11010000010","11000010100","11000010010","10010001100", // 96-99 approx
    "10110111000","10110001110","11001011100","11010011100",
  ];
  raw.forEach((p, i) => { C128_PATTERNS[i] = p; });
  C128_PATTERNS[C128_STOP] = "1100011101011";
})();

function code128BValue(char: string): number {
  return char.charCodeAt(0) - 32;
}

export function code128Bars(text: string, totalWidth: number): BarRect[] {
  const values: number[] = [C128_START_B];
  let checksum = C128_START_B;
  for (let i = 0; i < text.length; i++) {
    const v = code128BValue(text[i]);
    values.push(v);
    checksum += v * (i + 1);
  }
  values.push(checksum % 103);
  values.push(C128_STOP);

  let bits = values.map((v) => C128_PATTERNS[v] ?? "").join("");
  const totalModules = bits.length;
  if (totalModules === 0) return [];

  const moduleW = totalWidth / totalModules;
  const bars: BarRect[] = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === "1") {
      let w = 0;
      while (i < bits.length && bits[i] === "1") { w++; i++; }
      bars.push({ x: (i - w) * moduleW, width: w * moduleW });
    } else {
      i++;
    }
  }
  return bars;
}

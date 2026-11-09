export const BANNED = ["seamless", "seamlessly", "revolutionize", "revolutionise", "leverage", "empower", "cutting-edge",
  "game-changer", "game changer", "unlock", "robust", "delve", "elevate", "harness", "transformative",
  "state-of-the-art", "next-generation", "synergy", "unleash", "supercharge", "in today's world"];

export function lintText(label, s) {
  const problems = [];
  if (/[—–]/.test(s)) problems.push(`${label}: contains an em or en dash`);
  const lower = s.toLowerCase();
  for (const w of BANNED) if (lower.includes(w)) problems.push(`${label}: banned word "${w}"`);
  return problems;
}

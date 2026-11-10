import type { BrandKit } from "@/lib/types";

export const DEFAULT_BRAND_KIT: BrandKit = {
  primaryColor: "#173D2D",
  accentColor: "#C9FA78",
  backgroundColor: "#F8F8F2",
  textColor: "#1E2922",
  theme: "light",
  style: "editorial",
  fontFamily: "Hanken Grotesk",
  aspectRatio: "square"
};

const validHex = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

export function normaliseBrandKit(value: unknown): BrandKit {
  const saved = value && typeof value === "object" ? value as Partial<BrandKit> : {};
  const style = ["editorial", "technical", "bold", "minimal"].includes(saved.style ?? "") ? saved.style! : DEFAULT_BRAND_KIT.style;
  const fontFamily = ["Hanken Grotesk", "JetBrains Mono", "Georgia", "Arial"].includes(saved.fontFamily ?? "") ? saved.fontFamily! : DEFAULT_BRAND_KIT.fontFamily;
  const aspectRatio = ["square", "landscape", "portrait"].includes(saved.aspectRatio ?? "") ? saved.aspectRatio! : DEFAULT_BRAND_KIT.aspectRatio;
  const theme = saved.theme === "dark" ? "dark" : "light";
  return {
    ...DEFAULT_BRAND_KIT,
    primaryColor: validHex(saved.primaryColor, DEFAULT_BRAND_KIT.primaryColor),
    accentColor: validHex(saved.accentColor, DEFAULT_BRAND_KIT.accentColor),
    backgroundColor: validHex(saved.backgroundColor, DEFAULT_BRAND_KIT.backgroundColor),
    textColor: validHex(saved.textColor, DEFAULT_BRAND_KIT.textColor),
    theme,
    style: style as BrandKit["style"],
    fontFamily: fontFamily as BrandKit["fontFamily"],
    aspectRatio: aspectRatio as BrandKit["aspectRatio"],
  };
}

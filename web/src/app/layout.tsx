import type { Metadata } from "next";
import { Archivo, Azeret_Mono, Outfit } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { LangProvider } from "@/lib/i18n";
import { serverLang } from "@/lib/lang-server";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin", "latin-ext"] });
const azeret = Azeret_Mono({ variable: "--font-azeret", subsets: ["latin", "latin-ext"], weight: ["300", "400", "500"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin", "latin-ext"], weight: ["300", "400", "600"] });

export const metadata: Metadata = {
  title: `${BRAND.name}: ${BRAND.tagline}`,
  description: BRAND.description,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await serverLang();
  return (
    <html lang={lang} className={`${archivo.variable} ${azeret.variable} ${outfit.variable}`}>
      <body className="min-h-dvh bg-g-1 text-t-1">
        <LangProvider initial={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}

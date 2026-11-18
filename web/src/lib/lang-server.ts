import "server-only";
import { cookies, headers } from "next/headers";
import { DICT, type Lang } from "./dict";

export const LANG_COOKIE = "pcbai_lang";

export async function serverLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (c === "tr" || c === "en") return c;
  const al = (await headers()).get("accept-language") ?? "";
  return al.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export async function serverT() {
  const lang = await serverLang();
  return { lang, t: DICT[lang] };
}

export async function appT() {
  const { APP } = await import("./dict-app");
  const lang = await serverLang();
  return { lang, a: APP[lang], t: DICT[lang] };
}

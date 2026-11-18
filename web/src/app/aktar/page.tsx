import Link from "next/link";
import { LabImport } from "@/components/app/LabImport";
import { LAB_IMPORT_TEXT } from "@/lib/lab/import-text";
import { Logo } from "@/components/site/Logo";
import { currentUser } from "@/lib/auth";
import { LangSwitch } from "@/lib/i18n";
import { serverLang } from "@/lib/lang-server";

export default async function ImportPage() {
  const user = await currentUser();
  const t = LAB_IMPORT_TEXT[await serverLang()];
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-6 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href={user ? "/panel" : "/"} className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="font-display text-[17px] font-semibold tracking-tight">pcb<span className="text-teal-300">·</span>ai</span>
        </Link>
        <LangSwitch />
      </div>
      <h1 className="h-display mt-12 text-[44px]">{t.title}</h1>
      <p className="mb-10 mt-3 max-w-[46rem] text-[15px] text-t-2">{t.lede}</p>
      <LabImport loggedIn={!!user} />
    </div>
  );
}

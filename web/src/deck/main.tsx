import { createRoot } from "react-dom/client";
import { LangProvider } from "@/lib/i18n";
import Deck from "./Deck";

createRoot(document.getElementById("root")!).render(
  <LangProvider force="tr">
    <Deck />
  </LangProvider>,
);

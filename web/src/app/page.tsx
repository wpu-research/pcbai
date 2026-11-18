import { Cta, Faq, Footer, Outputs, Pricing } from "@/components/site/Closing";
import { Factory } from "@/components/site/Factory";
import { Hero } from "@/components/site/Hero";
import { Lab } from "@/components/site/Lab";
import { Nav } from "@/components/site/Nav";
import { Process } from "@/components/site/Process";
import { Products } from "@/components/site/Products";
import { Rail } from "@/components/site/Rail";
import StageMount from "@/components/site/StageMount";

export default function Home() {
  return (
    <>
      <Nav />
      <Rail />
      <main className="relative z-[2]">
        <Hero />
        <Products />
        <Lab />
        <Process />
        <Factory />
        <Outputs />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
      <StageMount />
    </>
  );
}

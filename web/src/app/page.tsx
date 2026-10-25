import { AssistantPanel } from "@/components/AssistantPanel";
import { CatalogView } from "@/components/CatalogView";

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Fresh sweets, by the box</h1>
        <p className="text-muted">Every sweet comes in small (250 g), medium (500 g) and large (1 kg) boxes.</p>
      </section>
      <AssistantPanel />
      <CatalogView />
    </div>
  );
}

import { Footer } from "@/components/home/Footer";
import { HomeView } from "@/components/home/HomeView";
import { TopNav } from "@/components/home/TopNav";

export default function Home() {
  return (
    <>
      <TopNav />
      <main id="main" className="w-full">
        <HomeView />
      </main>
      <Footer />
    </>
  );
}

import type { Metadata } from "next";
import GamemcuHangzhouPage from "@/features/GamemcuHangzhouPage";
import "@/features/gamemcu-hz.css";

export const metadata: Metadata = {
  title: "水墨杭州",
  description: "An online ink-style city of Hangzhou, made by gamemcu",
  icons: { icon: "/assets/seo/favicon.ico" },
};

export default function Page() {
  return <GamemcuHangzhouPage />;
}

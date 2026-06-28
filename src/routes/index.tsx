import { createFileRoute } from "@tanstack/react-router";
import ImtamApp from "../imtam/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IMTAM 임탐 오픈하우스 매칭" },
      { name: "description", content: "프리미엄 실주택 오픈하우스 임장 예약과 소유주 매물 등록을 연결하는 IMTAM 플랫폼입니다." },
      { property: "og:title", content: "IMTAM 임탐 오픈하우스 매칭" },
      { property: "og:description", content: "프리미엄 실주택 오픈하우스 임장 예약과 소유주 매물 등록을 연결하는 IMTAM 플랫폼입니다." },
    ],
  }),
  component: Index,
});

function Index() {
  return <ImtamApp />;
}

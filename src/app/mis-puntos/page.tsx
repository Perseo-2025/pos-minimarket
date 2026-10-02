import type { Metadata } from "next";
import { AppFooter } from "@/components/layout/app-footer";
import { MyPointsView } from "./my-points-view";

export const metadata: Metadata = {
  title: "Mis puntos · Trabajadores del aeropuerto",
};

// Public page (no staff login): an airport worker checks their points and
// purchase history with DNI + birth date.
export default function MyPointsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <div className="flex flex-1 items-start justify-center p-4 pt-10 sm:items-center sm:pt-4">
        <MyPointsView />
      </div>
      <AppFooter />
    </div>
  );
}

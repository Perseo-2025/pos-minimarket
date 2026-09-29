import type { Metadata } from "next";
import { MyPointsView } from "./my-points-view";

export const metadata: Metadata = {
  title: "Mis puntos · Trabajadores del aeropuerto",
};

// Public page (no staff login): an airport worker checks their points and
// purchase history with DNI + PIN.
export default function MyPointsPage() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-muted p-4 pt-10 sm:items-center sm:pt-4">
      <MyPointsView />
    </div>
  );
}

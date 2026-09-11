"use client";

import { usePathname } from "next/navigation";
import AdminShell from "@/components/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // La pagina di login e' l'unica fuori dal guard, altrimenti si entra
  // in un ciclo di redirect.
  if (usePathname() === "/admin/login") return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}

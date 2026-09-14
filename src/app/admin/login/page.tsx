"use client";

import CoachLogin from "@/components/CoachLogin";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Area coach</h1>
      <p className="mt-2 text-sm text-slate-400">Accedi per gestire orari e prenotazioni.</p>
      <div className="mt-6">
        <CoachLogin />
      </div>
    </main>
  );
}

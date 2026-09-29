"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";

type AdminRow = { admin_id: string; admin_email: string | null };

/**
 * Collega la riga di un coach al suo account. Servono unite perché il
 * pannello sappia che "Luca che ha gli orari" e "Luca che fa il login"
 * sono la stessa persona.
 */
export default function CoachAccount({
  coachId,
  userId,
  onChanged,
}: {
  coachId: string;
  userId: string | null;
  onChanged: () => void;
}) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("list_admins");
      setAdmins((data as AdminRow[]) ?? []);
    })();
  }, []);

  async function assign(value: string) {
    setError(null);
    const { error } = await supabase.rpc("set_coach_user", {
      p_coach_id: coachId,
      p_user_id: value || null,
    });
    if (error) setError(bookingErrorMessage(error));
    else onChanged();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-slate-400" htmlFor={`account-${coachId}`}>
        Account
      </label>
      <select
        id={`account-${coachId}`}
        className="field !w-auto !min-h-[34px] !py-1 text-xs"
        value={userId ?? ""}
        onChange={(e) => void assign(e.target.value)}
      >
        <option value="">nessuno</option>
        {admins.map((a) => (
          <option key={a.admin_id} value={a.admin_id}>
            {a.admin_email ?? a.admin_id}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}

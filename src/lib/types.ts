export type PublicSettings = {
  gym_name: string;
  intro_text: string;
  booking_horizon_days: number;
  min_notice_hours: number;
  max_trials_per_day: number;
  min_age: number;
  guardian_required_under_age: number;
  contact_email: string | null;
  contact_phone: string | null;
  privacy_text: string | null;
  vapid_public_key: string | null;
};

export type Availability = {
  day: string;
  slot_id: string;
  coach_id: string;
  coach_name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked: number;
  day_booked: number;
  day_remaining: number;
  remaining: number;
};

export type Coach = {
  id: string;
  name: string;
  active: boolean;
  user_id: string | null;
};

export type WeeklySlot = {
  id: string;
  coach_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number;
  active: boolean;
};

export type Closure = {
  id: string;
  day: string;
  reason: string | null;
};

export type Booking = {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  full_name: string;
  birth_date: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  email: string;
  phone: string;
  notes: string | null;
  status: "confirmed" | "cancelled";
  coach_id: string;
  created_at: string;
};

export type Settings = {
  gym_name: string;
  intro_text: string;
  max_trials_per_day: number;
  booking_horizon_days: number;
  min_notice_hours: number;
  min_age: number;
  guardian_required_under_age: number;
  contact_email: string | null;
  contact_phone: string | null;
  privacy_text: string | null;
};

export const UNITS = ["reps", "seconds", "kg", "meters"] as const;
export type ExerciseUnit = (typeof UNITS)[number];

export const UNIT_LABEL: Record<ExerciseUnit, string> = {
  reps: "ripetizioni",
  seconds: "secondi",
  kg: "kg",
  meters: "metri",
};

export type Exercise = {
  id: string;
  name: string;
  category: string | null;
  unit: ExerciseUnit;
  notes: string | null;
  active: boolean;
};

export type Person = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  is_student: boolean;
  coach_id: string | null;
  intake_updated_at: string | null;
  last_booking: string | null;
};

export type IntakeAnswer = {
  question_id: string;
  value: unknown;
  updated_at: string;
};

export type AssessmentRow = {
  assessment_id: string;
  day: string;
  notes: string | null;
  exercise_id: string;
  exercise_name: string;
  value: number;
  unit: ExerciseUnit;
};

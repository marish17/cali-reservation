export type PublicSettings = {
  gym_name: string;
  intro_text: string;
  booking_horizon_days: number;
  min_notice_hours: number;
  max_trials_per_day: number;
  contact_email: string | null;
  contact_phone: string | null;
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
  contact_email: string | null;
  contact_phone: string | null;
};

export type Role = "admin" | "member";
export type MembershipStatus = "invited" | "active" | "left";
export type EventStatus = "proposed" | "confirmed" | "cancelled";
export type VoteResponse = "yes" | "no" | "maybe";
export type RsvpResponse = "going" | "not_going" | "maybe";

export type Profile = { id: string; name: string; avatar_url: string | null };

export type Membership = {
  id: string;
  user_id: string;
  group_id: string;
  role: Role;
  status: MembershipStatus;
  joined_at: string | null;
  left_at: string | null;
  profiles: Profile | null;
};

export type FriendGroup = { id: string; name: string; created_by: string; created_at: string };

export type TimeOption = { id: string; event_id: string; proposed_time: string };
export type Vote = { id: string; time_option_id: string; user_id: string; response: VoteResponse };
export type Rsvp = { id: string; event_id: string; user_id: string; response: RsvpResponse };

export type GroupEvent = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  location: string | null;
  notes: string | null;
  status: EventStatus;
  confirmed_time: string | null;
  ends_at: string | null;
  created_at: string;
};

export type Challenge = {
  id: string;
  group_id: string;
  title: string;
  type: "distance" | "count" | "custom";
  unit: string;
  target: number | null;
  target_mode: "per_person" | "group";
  start_date: string;
  end_date: string;
  created_by: string;
};

export type ChallengeEntry = {
  id: string;
  challenge_id: string;
  user_id: string;
  amount: number;
  note: string | null;
  logged_at: string;
};

export type AlbumLink = {
  id: string;
  group_id: string;
  event_id: string | null;
  icloud_share_url: string;
  created_by: string;
  created_at: string;
  reminder_sent_at: string | null;
};

export const DEFAULT_ROSTER_SIZE = 7;

/** Alphanumeric, ambiguous characters (0/O, 1/I/L) excluded so codes are easy to read aloud/type. */
export const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 8;

export const DEFAULT_TRADE_WINDOW = {
  openDay: 1, // Monday
  openTime: "08:00",
  closeDay: 3, // Wednesday
  closeTime: "23:59",
  timezone: "America/New_York",
} as const;

export const DEFAULT_SECONDS_PER_PICK = 90;

export const ROOKIE_BONUS = {
  firstYear: 10,
  secondYear: 5,
} as const;

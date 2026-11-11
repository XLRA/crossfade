import { describe, expect, it } from "vitest";

import { formatAddedAt, formatDuration, formatLongDuration, plural } from "./format";

describe("formatDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatDuration(187_000)).toBe("3:07");
    expect(formatDuration(5_000)).toBe("0:05");
  });

  it("adds hours for anything an hour or longer", () => {
    expect(formatDuration(3_764_000)).toBe("1:02:44");
  });

  it("rounds to the nearest second", () => {
    expect(formatDuration(59_500)).toBe("1:00");
  });

  it("shows a dash when the length is unknown", () => {
    for (const unknown of [0, -1, null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatDuration(unknown)).toBe("–:––");
    }
  });
});

describe("formatLongDuration", () => {
  it("uses hours and minutes for long playlists", () => {
    expect(formatLongDuration(5_520_000)).toBe("1 hr 32 min");
  });

  it("drops the seconds once it's ten minutes or more", () => {
    expect(formatLongDuration(2_830_000)).toBe("47 min");
  });

  it("keeps the seconds for short ones", () => {
    expect(formatLongDuration(250_000)).toBe("4 min 10 sec");
    expect(formatLongDuration(240_000)).toBe("4 min");
    expect(formatLongDuration(45_000)).toBe("45 sec");
  });
});

describe("plural", () => {
  it("picks the singular or plural form", () => {
    expect(plural(1, "track")).toBe("1 track");
    expect(plural(0, "track")).toBe("0 tracks");
    expect(plural(2, "person", "people")).toBe("2 people");
  });

  it("groups thousands", () => {
    expect(plural(1_200, "track")).toBe("1,200 tracks");
  });
});

describe("formatAddedAt", () => {
  const now = new Date("2026-11-10T15:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it("says how long ago for the last week", () => {
    expect(formatAddedAt(ago(20_000), now)).toBe("just now");
    expect(formatAddedAt(ago(5 * MINUTE), now)).toBe("5 minutes ago");
    expect(formatAddedAt(ago(2 * HOUR), now)).toBe("2 hours ago");
    expect(formatAddedAt(ago(DAY), now)).toBe("yesterday");
    expect(formatAddedAt(ago(3 * DAY), now)).toBe("3 days ago");
  });

  it("switches to a date after a week", () => {
    expect(formatAddedAt(new Date("2026-10-20T15:00:00Z"), now)).toBe("Oct 20, 2026");
  });

  it("accepts the ISO strings that come over the wire", () => {
    expect(formatAddedAt(ago(2 * HOUR).toISOString(), now)).toBe("2 hours ago");
  });
});

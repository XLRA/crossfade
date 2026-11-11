import { describe, expect, it } from "vitest";

import { cleanChannelName, decodeEntities, parseIsoDuration, splitVideoTitle, youtubeThumbnail } from "./youtube-text";

describe("parseIsoDuration", () => {
  it.each([
    ["PT3M7S", 187_000],
    ["PT1H2M3S", 3_723_000],
    ["PT45S", 45_000],
    ["PT10M", 600_000],
    ["PT1.5S", 1_500],
    ["P1DT2H", 93_600_000],
  ])("reads %s", (iso, ms) => {
    expect(parseIsoDuration(iso)).toBe(ms);
  });

  it("treats live streams, missing values and junk as unknown (0)", () => {
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration(undefined)).toBe(0);
    expect(parseIsoDuration(null)).toBe(0);
    expect(parseIsoDuration("3:07")).toBe(0);
  });
});

describe("decodeEntities", () => {
  it("decodes the entities the search endpoint sends", () => {
    expect(decodeEntities("Don&#39;t Stop Me Now")).toBe("Don't Stop Me Now");
    expect(decodeEntities("Simon &amp; Garfunkel")).toBe("Simon & Garfunkel");
    expect(decodeEntities("&quot;Heroes&quot;")).toBe('"Heroes"');
    expect(decodeEntities("It&#x27;s &lt;3")).toBe("It's <3");
  });

  it("leaves unknown entities as they were", () => {
    expect(decodeEntities("&notathing; stays")).toBe("&notathing; stays");
  });
});

describe("cleanChannelName", () => {
  it.each([
    ["Daft Punk - Topic", "Daft Punk"],
    ["TaylorSwiftVEVO", "Taylor Swift"],
    ["Daft Punk Official", "Daft Punk"],
    ["Tame Impala", "Tame Impala"],
    ["NPR Music", "NPR Music"],
  ])("cleans %s", (channel, name) => {
    expect(cleanChannelName(channel)).toBe(name);
  });
});

describe("splitVideoTitle", () => {
  it("trusts auto-generated Topic channels for the artist", () => {
    expect(splitVideoTitle("One More Time", "Daft Punk - Topic")).toEqual({
      title: "One More Time",
      artist: "Daft Punk",
    });
  });

  it("splits Artist - Title and drops upload tags", () => {
    expect(splitVideoTitle("Daft Punk - One More Time (Official Video)", "Daft Punk")).toEqual({
      title: "One More Time",
      artist: "Daft Punk",
    });
    expect(splitVideoTitle("Tame Impala – The Less I Know The Better [Official Audio]", "TameImpalaVEVO")).toEqual({
      title: "The Less I Know The Better",
      artist: "Tame Impala",
    });
    expect(splitVideoTitle("Queen - Bohemian Rhapsody (Remastered 2011)", "Queen Official")).toEqual({
      title: "Bohemian Rhapsody",
      artist: "Queen",
    });
  });

  it("keeps tags that describe the recording itself", () => {
    expect(splitVideoTitle("Adele - Hello (Live at the NRJ Awards)", "AdeleVEVO")).toEqual({
      title: "Hello (Live at the NRJ Awards)",
      artist: "Adele",
    });
  });

  it("removes an Official Video suffix and quotes around the title", () => {
    expect(splitVideoTitle('Phoebe Bridgers - "Motion Sickness" | Official Video', "Phoebe Bridgers")).toEqual({
      title: "Motion Sickness",
      artist: "Phoebe Bridgers",
    });
  });

  it("decodes entities before splitting", () => {
    expect(splitVideoTitle("Simon &amp; Garfunkel - The Boxer (Audio)", "SimonAndGarfunkelVEVO")).toEqual({
      title: "The Boxer",
      artist: "Simon & Garfunkel",
    });
  });

  it("falls back to the channel when the title has no artist in it", () => {
    expect(splitVideoTitle("Tiny Desk Concert", "NPR Music")).toEqual({
      title: "Tiny Desk Concert",
      artist: "NPR Music",
    });
  });
});

describe("youtubeThumbnail", () => {
  it("uses the letterbox-free 16:9 rendition", () => {
    expect(youtubeThumbnail("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  });
});

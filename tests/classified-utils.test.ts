import { describe, it, expect } from "vitest";
import {
  parseClassifiedEvent,
  buildClassifiedEvent,
} from "@/utils/classifiedEvents";

// ---- Helpers for creating test events ----

function makeEvent(overrides: Record<string, any> = {}): any {
  return {
    id: "event-id-123",
    pubkey: "abc123pubkey",
    created_at: 1700000000,
    kind: 30402,
    content: "Test listing description",
    tags: [
      ["d", "test-d-tag"],
      ["title", "Test Listing"],
    ],
    ...overrides,
  };
}

// ---- parseClassifiedEvent ----

describe("parseClassifiedEvent", () => {
  it("returns null when d tag is missing", () => {
    const event = makeEvent({ tags: [["title", "Test"]] });
    expect(parseClassifiedEvent(event)).toBeNull();
  });

  it("returns null when title tag is missing", () => {
    const event = makeEvent({ tags: [["d", "test-d-tag"]] });
    expect(parseClassifiedEvent(event)).toBeNull();
  });

  it("parses a minimal valid event", () => {
    const event = makeEvent();
    const result = parseClassifiedEvent(event);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("event-id-123");
    expect(result!.pubkey).toBe("abc123pubkey");
    expect(result!.dTag).toBe("test-d-tag");
    expect(result!.title).toBe("Test Listing");
    expect(result!.description).toBe("Test listing description");
    expect(result!.status).toBe("unknown");
    expect(result!.images).toEqual([]);
    expect(result!.tags).toEqual([]);
    expect(result!.coordinate).toBe("30402:abc123pubkey:test-d-tag");
    expect(result!.createdAt).toBe(1700000000);
  });

  it("parses all optional tags", () => {
    const event = makeEvent({
      tags: [
        ["d", "full-listing"],
        ["title", "Full Listing"],
        ["published_at", "1699999999"],
        ["location", "Kansas City, MO"],
        ["g", "9yv0z"],
        ["price", "50000", "sats"],
        ["status", "active"],
        ["image", "https://example.com/img1.jpg"],
        ["image", "https://example.com/img2.jpg"],
        ["t", "bitcoin"],
        ["t", "hardware"],
        ["spec", "weight", "100g"],
      ],
    });
    const result = parseClassifiedEvent(event)!;

    expect(result.description).toBe("Test listing description");
    expect(result.publishedAt).toBe(1699999999);
    expect(result.location).toBe("Kansas City, MO");
    expect(result.geohash).toBe("9yv0z");
    expect(result.price).toEqual({
      amount: "50000",
      currency: "sats",
      frequency: undefined,
    });
    expect(result.status).toBe("active");
    expect(result.images).toEqual([
      "https://example.com/img1.jpg",
      "https://example.com/img2.jpg",
    ]);
    expect(result.tags).toEqual(["bitcoin", "hardware"]);
  });

  it("parses price with frequency", () => {
    const event = makeEvent({
      tags: [
        ["d", "test"],
        ["title", "Test"],
        ["price", "15", "EUR", "month"],
      ],
    });
    const result = parseClassifiedEvent(event)!;
    expect(result.price).toEqual({
      amount: "15",
      currency: "EUR",
      frequency: "month",
    });
  });

  it("defaults price currency to sats when missing", () => {
    const event = makeEvent({
      tags: [
        ["d", "test"],
        ["title", "Test"],
        ["price", "1000"],
      ],
    });
    const result = parseClassifiedEvent(event)!;
    expect(result.price).toEqual({
      amount: "1000",
      currency: "sats",
      frequency: undefined,
    });
  });

  it("recognizes sold status", () => {
    const event = makeEvent({
      tags: [
        ["d", "test"],
        ["title", "Test"],
        ["status", "sold"],
      ],
    });
    expect(parseClassifiedEvent(event)!.status).toBe("sold");
  });

  it("sets status to unknown for unrecognized values", () => {
    const event = makeEvent({
      tags: [
        ["d", "test"],
        ["title", "Test"],
        ["status", "expired"],
      ],
    });
    expect(parseClassifiedEvent(event)!.status).toBe("unknown");
  });

  it("sets status to unknown when status tag absent", () => {
    const event = makeEvent();
    expect(parseClassifiedEvent(event)!.status).toBe("unknown");
  });

  it("returns null on malformed event (throws)", () => {
    const event = { tags: null };
    expect(parseClassifiedEvent(event)).toBeNull();
  });

  it("handles event with empty content", () => {
    const event = makeEvent({ content: "" });
    const result = parseClassifiedEvent(event)!;
    expect(result.description).toBe("");
  });

  it("handles invalid published_at gracefully", () => {
    const event = makeEvent({
      tags: [
        ["d", "test"],
        ["title", "Test"],
        ["published_at", "not-a-number"],
      ],
    });
    const result = parseClassifiedEvent(event)!;
    expect(result.publishedAt).toBeUndefined();
  });

  it("filters out empty image and t tags", () => {
    const event = makeEvent({
      tags: [
        ["d", "test"],
        ["title", "Test"],
        ["image", ""],
        ["image", "https://example.com/img.jpg"],
        ["t", ""],
        ["t", "bitcoin"],
      ],
    });
    const result = parseClassifiedEvent(event)!;
    expect(result.images).toEqual(["https://example.com/img.jpg"]);
    expect(result.tags).toEqual(["bitcoin"]);
  });
});

// ---- buildClassifiedEvent ----

describe("buildClassifiedEvent", () => {
  it("builds an event with kind 30402", () => {
    const result = buildClassifiedEvent({
      title: "My Listing",
      description: "For sale",
    }) as any;
    expect(result.kind).toBe(30402);
  });

  it("includes CLIENT_TAG", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
    }) as any;
    const tagTypes = result.tags.map((t: string[]) => t[0]);
    expect(tagTypes).toContain("client");
  });

  it("includes required d and title tags", () => {
    const result = buildClassifiedEvent({
      dTag: "my-slug",
      title: "Test Title",
      description: "Desc",
    }) as any;
    const dTag = result.tags.find((t: string[]) => t[0] === "d");
    const titleTag = result.tags.find((t: string[]) => t[0] === "title");
    expect(dTag![1]).toBe("my-slug");
    expect(titleTag![1]).toBe("Test Title");
  });

  it("auto-generates dTag when not provided", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
    }) as any;
    const dTag = result.tags.find((t: string[]) => t[0] === "d");
    expect(dTag![1]).toMatch(/^classified-\d+-[a-z0-9]+$/);
  });

  it("includes published_at with current timestamp", () => {
    const before = Math.floor(Date.now() / 1000);
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
    }) as any;
    const after = Math.floor(Date.now() / 1000);
    const pubTag = result.tags.find(
      (t: string[]) => t[0] === "published_at",
    );
    const ts = parseInt(pubTag![1], 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("includes price tag with 3 elements when no frequency", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
      priceAmount: "50000",
      priceCurrency: "sats",
    }) as any;
    const priceTag = result.tags.find((t: string[]) => t[0] === "price");
    expect(priceTag).toEqual(["price", "50000", "sats"]);
  });

  it("includes price tag with 4 elements when frequency provided", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
      priceAmount: "15",
      priceCurrency: "EUR",
      priceFrequency: "month",
    }) as any;
    const priceTag = result.tags.find((t: string[]) => t[0] === "price");
    expect(priceTag).toEqual(["price", "15", "EUR", "month"]);
  });

  it("omits price tag when amount or currency missing", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
      priceAmount: "50000",
    }) as any;
    const priceTag = result.tags.find((t: string[]) => t[0] === "price");
    expect(priceTag).toBeUndefined();
  });

  it("defaults status to active", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
    }) as any;
    const statusTag = result.tags.find((t: string[]) => t[0] === "status");
    expect(statusTag![1]).toBe("active");
  });

  it("includes optional tags only when provided", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
      location: "Kansas City",
      geohash: "9yv0z",
    }) as any;
    const tagTypes = result.tags.map((t: string[]) => t[0]);
    expect(tagTypes).toContain("location");
    expect(tagTypes).toContain("g");
  });

  it("omits optional tags when not provided", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
    }) as any;
    const tagTypes = result.tags.map((t: string[]) => t[0]);
    expect(tagTypes).not.toContain("location");
    expect(tagTypes).not.toContain("g");
  });

  it("creates one image tag per URL", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
      images: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
      ],
    }) as any;
    const imageTags = result.tags.filter(
      (t: string[]) => t[0] === "image",
    );
    expect(imageTags).toHaveLength(2);
    expect(imageTags[0][1]).toBe("https://example.com/1.jpg");
    expect(imageTags[1][1]).toBe("https://example.com/2.jpg");
  });

  it("skips empty image URLs", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
      images: ["https://example.com/1.jpg", "", "  "],
    }) as any;
    const imageTags = result.tags.filter(
      (t: string[]) => t[0] === "image",
    );
    expect(imageTags).toHaveLength(1);
  });

  it("creates one t tag per category", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
      tags: ["bitcoin", "hardware"],
    }) as any;
    const tTags = result.tags.filter((t: string[]) => t[0] === "t");
    expect(tTags).toHaveLength(2);
  });

  it("skips empty tags", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
      tags: ["bitcoin", "", "  "],
    }) as any;
    const tTags = result.tags.filter((t: string[]) => t[0] === "t");
    expect(tTags).toHaveLength(1);
  });

  it("sets content to description", () => {
    const result = buildClassifiedEvent({
      title: "Test",
      description: "# Hello\n\nWorld",
    }) as any;
    expect(result.content).toBe("# Hello\n\nWorld");
  });

  it("sets created_at to current time", () => {
    const before = Math.floor(Date.now() / 1000);
    const result = buildClassifiedEvent({
      title: "Test",
      description: "Desc",
    }) as any;
    const after = Math.floor(Date.now() / 1000);
    expect(result.created_at).toBeGreaterThanOrEqual(before);
    expect(result.created_at).toBeLessThanOrEqual(after);
  });
});

// ---- Roundtrip: build → parse ----

describe("build → parse roundtrip", () => {
  it("preserves all fields through roundtrip", () => {
    const built = buildClassifiedEvent({
      dTag: "roundtrip-test",
      title: "Roundtrip Listing",
      description: "Full description here",
      location: "Kansas City",
      geohash: "9yv0z",
      priceAmount: "25000",
      priceCurrency: "sats",
      priceFrequency: "week",
      status: "active",
      images: ["https://example.com/img.jpg"],
      tags: ["bitcoin", "test"],
    });

    // Simulate signing (just add id/pubkey/created_at)
    const signed = {
      ...built,
      id: "fake-id",
      pubkey: "fake-pubkey",
      created_at: built.created_at as number,
      sig: "fakesig",
    };

    const parsed = parseClassifiedEvent(signed)!;
    expect(parsed).not.toBeNull();
    expect(parsed.dTag).toBe("roundtrip-test");
    expect(parsed.title).toBe("Roundtrip Listing");
    expect(parsed.description).toBe("Full description here");
    expect(parsed.location).toBe("Kansas City");
    expect(parsed.geohash).toBe("9yv0z");
    expect(parsed.price).toEqual({
      amount: "25000",
      currency: "sats",
      frequency: "week",
    });
    expect(parsed.status).toBe("active");
    expect(parsed.images).toEqual(["https://example.com/img.jpg"]);
    expect(parsed.tags).toEqual(["bitcoin", "test"]);
    expect(parsed.coordinate).toBe("30402:fake-pubkey:roundtrip-test");
  });
});

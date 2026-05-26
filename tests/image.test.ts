import { describe, it, expect } from "vitest";
import { isImageDataUrl, MAX_IMAGE_DATA_URL_CHARS } from "@/lib/image";

describe("isImageDataUrl", () => {
  it("accepts png/jpeg/jpg/webp base64 data URLs", () => {
    expect(isImageDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isImageDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
    expect(isImageDataUrl("data:image/jpg;base64,/9j/4AAQ")).toBe(true);
    expect(isImageDataUrl("data:image/webp;base64,UklGRhZ")).toBe(true);
  });

  it("rejects non-image, non-data-url, gif, empty-body, or empty input", () => {
    expect(isImageDataUrl("https://example.com/x.png")).toBe(false);
    expect(isImageDataUrl("data:text/plain;base64,aGk=")).toBe(false);
    expect(isImageDataUrl("data:image/gif;base64,R0lGOD")).toBe(false);
    expect(isImageDataUrl("data:image/png;base64,")).toBe(false);
    expect(isImageDataUrl("")).toBe(false);
    expect(isImageDataUrl("data:image/png;base64,abc===")).toBe(false);
  });

  it("exposes the expected char cap", () => {
    expect(MAX_IMAGE_DATA_URL_CHARS).toBe(10_000_000);
  });
});

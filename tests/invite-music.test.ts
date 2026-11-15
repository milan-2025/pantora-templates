import { describe, it, expect, vi, beforeAll } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanState, publicView } from "@/lib/invites";

const SONG = "https://res.cloudinary.com/democloud/video/upload/v1/invites/aanya-rohan/song.m4a";
beforeAll(() => {
  process.env.CLOUDINARY_URL = "cloudinary://key:secret@democloud";
});

describe("uploaded songs", () => {
  it("are saved with the invite when they are our own Cloudinary uploads", () => {
    expect(cleanState({ pk: "custom", au: SONG })?.au).toBe(SONG);
  });
  it("drop browser-only links and outside URLs", () => {
    expect(cleanState({ pk: "custom", au: "blob:https://pandoratemplates.com/1234" })?.au).toBeUndefined();
    expect(cleanState({ pk: "custom", au: "https://evil.example/song.mp3" })?.au).toBeUndefined();
    expect(cleanState({ pk: "custom", au: "https://res.cloudinary.com/othercloud/video/upload/x.mp3" })?.au).toBeUndefined();
    expect(cleanState({ pk: "custom", au: "https://res.cloudinary.com/democloud/image/upload/x.jpg" })?.au).toBeUndefined();
  });
  it("play for Premium and Royal guests", () => {
    for (const plan of ["premium", "royal"]) {
      const { state } = publicView({ pk: "custom", au: SONG }, null, plan);
      expect(state).toMatchObject({ pk: "custom", au: SONG });
    }
  });
  it("fall back to the built-in Raga track on Basic, or if no song was saved", () => {
    expect(publicView({ pk: "custom", au: SONG }, null, "basic").state).toMatchObject({ pk: "raga" });
    expect(publicView({ pk: "custom", au: SONG }, null, "basic").state.au).toBeUndefined();
    expect(publicView({ pk: "custom" }, null, "royal").state.pk).toBe("raga");
    expect(publicView({ pk: "sitar" }, null, "basic").state.pk).toBe("sitar");
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { validateContentForm } from "../features/contents/schemas/content-form.ts";
import {
  isContentFormat,
  isContentPriority,
  isContentStatus,
} from "../features/contents/types/content.ts";
import { ApiClientError, getErrorMessage } from "../lib/api/errors.ts";

test("TC-02: Content form rejects submission when title is missing or only whitespace", () => {
  const emptyTitleResult = validateContentForm({
    title: "    ",
    channel_id: "channel-1",
    format_type: "short_video",
    description: "",
    script_draft: "",
    priority: "medium",
    scheduled_date: "",
  });

  assert.equal(emptyTitleResult.title, "Judul konten wajib diisi.");
});

test("TC-02 simulated server error: Backend title validation error maps to title field", () => {
  const serverErrorPayload = {
    message: "Kolom title wajib diisi.",
    errors: {
      title: ["Kolom title wajib diisi."],
    },
  };
  const apiError = new ApiClientError("Unprocessable Entity", 422, serverErrorPayload);
  const message = getErrorMessage(apiError);

  assert.equal(message, "Kolom title wajib diisi.");

  const errors = {};
  if (message.toLowerCase().includes("title") || message.toLowerCase().includes("judul")) {
    errors.title = message;
  }

  assert.equal(errors.title, "Kolom title wajib diisi.");
});

test("content form requires all 3 core fields: title, channel_id, format_type", () => {
  const allEmpty = validateContentForm({
    title: "",
    channel_id: "",
    format_type: "",
    description: "",
    script_draft: "",
    priority: "medium",
    scheduled_date: "",
  });

  assert.deepEqual(allEmpty, {
    title: "Judul konten wajib diisi.",
    channel_id: "Channel ID wajib diisi.",
    format_type: "Format konten wajib diisi.",
  });

  const validForm = validateContentForm({
    title: "5 Tips for Clean Architecture",
    channel_id: "chan-99",
    format_type: "carousel",
    description: "Architectural overview for dev team",
    script_draft: "Slide 1: Introduction",
    priority: "high",
    scheduled_date: "2026-11-01",
  });

  assert.deepEqual(validForm, {});
});

test("filter criteria logic correctly partitions contents by status and format", () => {
  const sampleContents = [
    { id: 1, title: "Content A", status: "idea", format_type: "short_video" },
    { id: 2, title: "Content B", status: "scripting", format_type: "long_video" },
    { id: 3, title: "Content C", status: "idea", format_type: "carousel" },
  ];

  const ideaFiltered = sampleContents.filter((c) => c.status === "idea");
  assert.equal(ideaFiltered.length, 2);

  const carouselFiltered = sampleContents.filter((c) => c.format_type === "carousel");
  assert.equal(carouselFiltered.length, 1);
  assert.equal(carouselFiltered[0].title, "Content C");
});

test("content status, format, and priority enum integrity", () => {
  assert.equal(isContentStatus("idea"), true);
  assert.equal(isContentStatus("scripting"), true);
  assert.equal(isContentStatus("recording"), true);
  assert.equal(isContentStatus("editing"), true);
  assert.equal(isContentStatus("ready"), true);
  assert.equal(isContentStatus("published"), true);
  assert.equal(isContentStatus("cancelled"), false);

  assert.equal(isContentFormat("short_video"), true);
  assert.equal(isContentFormat("long_video"), true);
  assert.equal(isContentFormat("carousel"), true);
  assert.equal(isContentFormat("single_post"), true);
  assert.equal(isContentFormat("story"), false);

  assert.equal(isContentPriority("low"), true);
  assert.equal(isContentPriority("medium"), true);
  assert.equal(isContentPriority("high"), true);
  assert.equal(isContentPriority("critical"), false);
});

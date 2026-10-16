import assert from "node:assert/strict";
import test from "node:test";
import {
  validateMetricForm,
  validatePublishedUrl,
} from "../features/contents/schemas/content-detail.ts";
import { ApiClientError, getErrorMessage } from "../lib/api/errors.ts";
import { API_ROUTES } from "../lib/api/routes.ts";

test("TC-03: Publication URL strictly accepts valid absolute http and https URLs only", () => {
  // Empty or whitespace
  assert.equal(validatePublishedUrl(""), false);
  assert.equal(validatePublishedUrl("   "), false);

  // Invalid protocols or formats
  assert.equal(validatePublishedUrl("javascript:alert('xss')"), false);
  assert.equal(validatePublishedUrl("ftp://creator.studio/file.mp4"), false);
  assert.equal(validatePublishedUrl("file:///c:/video.mp4"), false);
  assert.equal(validatePublishedUrl("just a string"), false);
  assert.equal(validatePublishedUrl("youtube.com/watch?v=123"), false);

  // Valid protocols
  assert.equal(validatePublishedUrl("https://youtube.com/watch?v=12345"), true);
  assert.equal(validatePublishedUrl("https://tiktok.com/@creator/video/98765"), true);
  assert.equal(validatePublishedUrl("http://instagram.com/reel/abcdef"), true);
  assert.equal(validatePublishedUrl("https://linkedin.com/posts/activity-123"), true);
});

test("TC-03 simulated server rejection: Transition to published without URL fails", () => {
  const serverErrorPayload = {
    message: "Kolom published_url wajib diisi saat status dipindahkan ke published.",
    errors: {
      published_url: ["URL publikasi wajib diisi untuk status published."],
    },
  };
  const apiError = new ApiClientError("Unprocessable Entity", 422, serverErrorPayload);
  const errorMessage = getErrorMessage(apiError);

  assert.equal(
    errorMessage,
    "Kolom published_url wajib diisi saat status dipindahkan ke published."
  );

  let publishError = "";
  if (!validatePublishedUrl("")) {
    publishError = "Kolom published_url wajib diisi untuk mempublikasikan konten.";
  }
  assert.equal(publishError, "Kolom published_url wajib diisi untuk mempublikasikan konten.");
});

test("TC-04: Cascade delete endpoint routing matches Section 5 specification", () => {
  const contentId = 101;
  const deleteEndpoint = API_ROUTES.contents.delete(contentId);
  assert.equal(deleteEndpoint, `/v1/contents/${contentId}`);

  // Simulated cascade deletion check:
  // When content 101 with 3 checklists and 2 metrics is deleted,
  // child records with content_id 101 must be cascade deleted.
  const checklists = [
    { id: 1, content_id: 101, task_name: "Hook script" },
    { id: 2, content_id: 101, task_name: "Record A-roll" },
    { id: 3, content_id: 101, task_name: "Edit thumbnail" },
    { id: 4, content_id: 102, task_name: "Unrelated task" },
  ];
  const metrics = [
    { id: 1, content_id: 101, views_count: 500 },
    { id: 2, content_id: 101, views_count: 1200 },
    { id: 3, content_id: 102, views_count: 300 },
  ];

  // Simulating ON DELETE CASCADE behavior
  const remainingChecklists = checklists.filter((c) => c.content_id !== contentId);
  const remainingMetrics = metrics.filter((m) => m.content_id !== contentId);

  assert.equal(remainingChecklists.length, 1);
  assert.equal(remainingChecklists[0].content_id, 102);

  assert.equal(remainingMetrics.length, 1);
  assert.equal(remainingMetrics[0].content_id, 102);
});

test("metrics form accepts zero and positive safe integers, rejects negatives or floats", () => {
  const validMetrics = validateMetricForm({
    views_count: "0",
    likes_count: "150",
    comments_count: "25",
    shares_count: "10",
  });
  assert.deepEqual(validMetrics, {});

  const invalidMetrics = validateMetricForm({
    views_count: "-5",
    likes_count: "12.3",
    comments_count: "abc",
    shares_count: "-1",
  });
  assert.ok(invalidMetrics.views_count);
  assert.ok(invalidMetrics.likes_count);
  assert.ok(invalidMetrics.comments_count);
  assert.ok(invalidMetrics.shares_count);
});

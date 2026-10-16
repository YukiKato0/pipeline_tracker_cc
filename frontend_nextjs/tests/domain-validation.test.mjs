import assert from "node:assert/strict";
import test from "node:test";
import { validateAuthForm } from "../features/auth/schemas/auth-form.ts";
import {
  initialChannelFormValues,
  validateChannelForm,
} from "../features/channels/schemas/channel-form.ts";
import { channelPreviewRecords } from "../features/channels/mock/channel-preview.ts";
import {
  clearSession,
  createSession,
  getSession,
  isAuthenticated,
} from "../lib/auth/session.ts";
import {
  initialContentFormValues,
  validateContentForm,
} from "../features/contents/schemas/content-form.ts";
import {
  initialMetricFormValues,
  sortMetricHistoryNewestFirst,
  validateMetricForm,
  validatePublishedUrl,
} from "../features/contents/schemas/content-detail.ts";
import { contentDetailPreview } from "../features/contents/mock/content-detail-preview.ts";
import {
  CONTENT_FORMATS,
  CONTENT_PRIORITIES,
  isContentFormat,
  isContentPriority,
  isContentStatus,
} from "../features/contents/types/content.ts";

test("login and register validation enforce their required fields", () => {
  const validLogin = validateAuthForm({
    name: "",
    email: "creator@example.com",
    password: "secure-pass",
    confirmPassword: "",
  }, "login");
  assert.deepEqual(validLogin, {});

  const invalidRegister = validateAuthForm({
    name: "A",
    email: "not-an-email",
    password: "short",
    confirmPassword: "different",
  }, "register");
  assert.deepEqual(Object.keys(invalidRegister).sort(), [
    "confirmPassword",
    "email",
    "name",
    "password",
  ]);
});

test("content form requires title, channel id, and format type", () => {
  assert.deepEqual(CONTENT_FORMATS, [
    "short_video",
    "long_video",
    "carousel",
    "single_post",
  ]);
  assert.deepEqual(CONTENT_PRIORITIES, ["low", "medium", "high"]);
  assert.equal(initialContentFormValues.priority, "medium");
  assert.equal(initialContentFormValues.script_draft, "");
  assert.equal(initialContentFormValues.scheduled_date, "");

  assert.deepEqual(validateContentForm({
    title: "  ",
    channel_id: "",
    format_type: "",
    description: "optional",
    script_draft: "optional",
    priority: "medium",
    scheduled_date: "",
  }), {
    title: "Judul konten wajib diisi.",
    channel_id: "Channel ID wajib diisi.",
    format_type: "Format konten wajib diisi.",
  });

  assert.deepEqual(validateContentForm({
    title: "A valid title",
    channel_id: "channel-1",
    format_type: "short_video",
    description: "",
    script_draft: "",
    priority: "high",
    scheduled_date: "2026-10-30",
  }), {});
});

test("publication URLs only allow absolute HTTP and HTTPS URLs", () => {
  assert.equal(validatePublishedUrl("https://creator.example/video"), true);
  assert.equal(validatePublishedUrl("http://creator.example/video"), true);
  assert.equal(validatePublishedUrl("javascript:alert(1)"), false);
  assert.equal(validatePublishedUrl("ftp://creator.example/video"), false);
  assert.equal(validatePublishedUrl("//creator.example/video"), false);
  assert.equal(validatePublishedUrl("not a URL"), false);
});

test("metrics accept zero and non-negative safe integers only", () => {
  assert.deepEqual(validateMetricForm({
    views_count: "0",
    likes_count: "18",
    comments_count: "2",
    shares_count: "1",
  }), {});

  const invalidMetrics = validateMetricForm({
    views_count: "-1",
    likes_count: "1.5",
    comments_count: "",
    shares_count: "9007199254740992",
  });
  assert.deepEqual(Object.keys(invalidMetrics).sort(), ["comments_count", "likes_count", "shares_count", "views_count"]);
  assert.deepEqual(validateMetricForm(initialMetricFormValues), {
    views_count: "Views harus berupa bilangan bulat non-negatif.",
    likes_count: "Likes harus berupa bilangan bulat non-negatif.",
    comments_count: "Comments harus berupa bilangan bulat non-negatif.",
    shares_count: "Shares harus berupa bilangan bulat non-negatif.",
  });
});

test("metric history is sorted newest first without mutating its input", () => {
  const snapshots = [
    { id: "old", recorded_at: "2026-10-08" },
    { id: "new", recorded_at: "2026-10-12" },
  ];

  assert.deepEqual(sortMetricHistoryNewestFirst(snapshots).map(({ id }) => id), ["new", "old"]);
  assert.deepEqual(snapshots.map(({ id }) => id), ["old", "new"]);
});

test("lifecycle status guard and local preview fixture stay within the contract", () => {
  assert.equal(isContentStatus("published"), true);
  assert.equal(isContentStatus("archived"), false);
  assert.equal(isContentFormat("short_video"), true);
  assert.equal(isContentFormat("reel"), false);
  assert.equal(isContentPriority("medium"), true);
  assert.equal(isContentPriority("urgent"), false);
  assert.equal(contentDetailPreview.id, "demo-42");
  assert.equal(contentDetailPreview.status, "editing");
});

test("channel form follows allowed platform values and handle_name limits", () => {
  assert.deepEqual(validateChannelForm({
    platform: "",
    handle_name: "",
  }), {
    platform: "Pilih platform channel yang tersedia.",
    handle_name: "Handle channel wajib diisi.",
  });

  assert.deepEqual(validateChannelForm({
    platform: "youtube",
    handle_name: "@techcreator",
  }), {});

  assert.deepEqual(validateChannelForm({
    platform: "facebook",
    handle_name: "x".repeat(101),
  }), {
    platform: "Pilih platform channel yang tersedia.",
    handle_name: "Handle channel maksimal 100 karakter.",
  });

  assert.equal(initialChannelFormValues.handle_name, "");
  assert.equal(channelPreviewRecords[0].handle_name, "@framestudio");
});

test("session helper tracks auth state without persisting secrets", () => {
  clearSession();
  assert.equal(isAuthenticated(), false);
  assert.equal(getSession(), null);

  const session = createSession({
    email: "creator@example.com",
    role: "creator",
    name: "Creator",
  });

  assert.equal(isAuthenticated(), true);
  assert.deepEqual(getSession(), session);
  assert.equal(typeof session.createdAt, "string");

  clearSession();
  assert.equal(isAuthenticated(), false);
  assert.equal(getSession(), null);
});
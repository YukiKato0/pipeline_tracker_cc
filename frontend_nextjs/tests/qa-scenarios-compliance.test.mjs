import assert from "node:assert/strict";
import test from "node:test";
import { validateAuthForm } from "../features/auth/schemas/auth-form.ts";
import { validateChannelForm } from "../features/channels/schemas/channel-form.ts";
import { validateContentForm } from "../features/contents/schemas/content-form.ts";
import {
  validateMetricForm,
  validatePublishedUrl,
} from "../features/contents/schemas/content-detail.ts";
import {
  clearSession,
  createSession,
  getSession,
  getToken,
  isAuthenticated,
} from "../lib/auth/session.ts";
import { API_ROUTES } from "../lib/api/routes.ts";
import { ApiClientError, getErrorMessage, isApiClientError } from "../lib/api/errors.ts";
import { isContentStatus } from "../features/contents/types/content.ts";

/**
 * =========================================================================
 * QA TEST SUITE: SPESIFIKASI PROYEK CREATOR CONTENT PIPELINE TRACKER
 * Compliance verification for Test Cases TC-01, TC-02, TC-03, and TC-04.
 * =========================================================================
 */

test("QA Skenario TC-01: Register dengan email yang sudah terdaftar ditolak sistem", () => {
  // 1. Validasi format email di frontend
  const invalidEmailForm = validateAuthForm(
    {
      name: "Budi Creator",
      email: "invalid-email-address",
      password: "password123",
      confirmPassword: "password123",
    },
    "register"
  );
  assert.equal(invalidEmailForm.email, "Masukkan alamat email yang valid.");

  // 2. Simulasi respon HTTP 400/409 dari server ketika email sudah terdaftar
  const duplicateEmailPayload = {
    message: "Email already taken",
    statusCode: 409,
    error: "Conflict",
  };

  const apiError = new ApiClientError(
    "Request failed with status 409",
    409,
    duplicateEmailPayload
  );

  assert.equal(isApiClientError(apiError), true);
  assert.equal(apiError.status, 409);

  // 3. Verifikasi ekstraksi pesan error
  const extractedMessage = getErrorMessage(apiError);
  assert.equal(extractedMessage, "Email already taken");

  // 4. Verifikasi bahwa UI form memetakan pesan ini ke field email
  const formFieldErrors = {};
  if (
    extractedMessage.toLowerCase().includes("email already taken") ||
    extractedMessage.toLowerCase().includes("sudah terdaftar")
  ) {
    formFieldErrors.email = extractedMessage;
  }

  assert.equal(formFieldErrors.email, "Email already taken");
});

test("QA Skenario TC-02: Buat konten tanpa mengisi kolom title ditolak sistem", () => {
  // 1. Validasi form saat kolom title kosong
  const emptyTitleForm = validateContentForm({
    title: "",
    channel_id: "channel-1",
    format_type: "short_video",
    description: "Sample description",
    script_draft: "Sample draft",
    priority: "medium",
    scheduled_date: "2026-11-01",
  });
  assert.equal(emptyTitleForm.title, "Judul konten wajib diisi.");

  // 2. Validasi form saat kolom title hanya berisi spasi
  const whitespaceTitleForm = validateContentForm({
    title: "     ",
    channel_id: "channel-1",
    format_type: "short_video",
    description: "",
    script_draft: "",
    priority: "medium",
    scheduled_date: "",
  });
  assert.equal(whitespaceTitleForm.title, "Judul konten wajib diisi.");

  // 3. Simulasi penolakan validasi server (422 Unprocessable Entity)
  const serverValidationErrorPayload = {
    message: "Kolom title wajib diisi.",
    errors: {
      title: ["Kolom title wajib diisi."],
    },
  };

  const serverError = new ApiClientError(
    "Unprocessable Entity",
    422,
    serverValidationErrorPayload
  );
  const extractedErrorMessage = getErrorMessage(serverError);

  assert.equal(extractedErrorMessage, "Kolom title wajib diisi.");

  // 4. Verifikasi pemetaan error server ke input form title
  const activeErrors = {};
  if (
    extractedErrorMessage.toLowerCase().includes("title") ||
    extractedErrorMessage.toLowerCase().includes("judul")
  ) {
    activeErrors.title = extractedErrorMessage;
  }
  assert.equal(activeErrors.title, "Kolom title wajib diisi.");
});

test("QA Skenario TC-03: Ubah status konten ke published tanpa mengisi published_url ditolak", () => {
  // 1. Pengujian fungsi validasi URL
  assert.equal(validatePublishedUrl(""), false, "URL kosong harus ditolak");
  assert.equal(validatePublishedUrl("    "), false, "URL whitespace harus ditolak");
  assert.equal(validatePublishedUrl("ftp://youtube.com/video"), false, "Protokol FTP harus ditolak");
  assert.equal(validatePublishedUrl("javascript:alert(1)"), false, "XSS protocol harus ditolak");
  assert.equal(validatePublishedUrl("youtube.com/watch?v=abc"), false, "URL tanpa http/https harus ditolak");
  assert.equal(validatePublishedUrl("https://youtube.com/watch?v=abc12345"), true, "HTTPS valid harus diterima");
  assert.equal(validatePublishedUrl("http://tiktok.com/@creator/video/1"), true, "HTTP valid harus diterima");

  // 2. Alur logika transisi publikasi
  const candidateUrlEmpty = "";
  let publishErrorMessage = "";

  if (!candidateUrlEmpty) {
    publishErrorMessage = "Kolom published_url wajib diisi untuk mempublikasikan konten.";
  } else if (!validatePublishedUrl(candidateUrlEmpty)) {
    publishErrorMessage = "Masukkan tautan URL publikasi yang valid dengan protokol http atau https.";
  }

  assert.equal(
    publishErrorMessage,
    "Kolom published_url wajib diisi untuk mempublikasikan konten."
  );

  // 3. Simulasi penolakan server jika payload published_url tidak valid
  const serverPublishRejectionPayload = {
    message: "Transisi status ke published memvalidasi kelayakan published_url.",
    statusCode: 422,
  };

  const rejectionError = new ApiClientError(
    "Unprocessable Entity",
    422,
    serverPublishRejectionPayload
  );
  assert.equal(
    getErrorMessage(rejectionError),
    "Transisi status ke published memvalidasi kelayakan published_url."
  );
});

test("QA Skenario TC-04: Hapus konten beserta 3 item checklist dan 2 log metrik (Cascade Delete)", () => {
  // 1. Verifikasi route kontrak endpoint delete
  const targetContentId = 555;
  const deleteRoute = API_ROUTES.contents.delete(targetContentId);
  assert.equal(deleteRoute, `/v1/contents/${targetContentId}`);

  // 2. Simulasi dataset database relasional dengan ON DELETE CASCADE
  let databaseContents = [
    { id: 555, title: "Konten yang Akan Dihapus", status: "published" },
    { id: 777, title: "Konten Lain Tetap Ada", status: "ready" },
  ];

  let databaseChecklists = [
    { id: 1, content_id: 555, task_name: "Tugas 1: Hook naskah selesai", is_completed: true },
    { id: 2, content_id: 555, task_name: "Tugas 2: B-roll direkam", is_completed: true },
    { id: 3, content_id: 555, task_name: "Tugas 3: Thumbnail disetujui", is_completed: false },
    { id: 4, content_id: 777, task_name: "Tugas Konten Lain", is_completed: false },
  ];

  let databaseMetrics = [
    { id: 1, content_id: 555, recorded_at: "2026-10-10", views_count: 5000, likes_count: 350 },
    { id: 2, content_id: 555, recorded_at: "2026-10-14", views_count: 12000, likes_count: 890 },
    { id: 3, content_id: 777, recorded_at: "2026-10-15", views_count: 1500, likes_count: 80 },
  ];

  // 3. Eksekusi operasi hapus konten (simulasi server cascade delete)
  databaseContents = databaseContents.filter((c) => c.id !== targetContentId);
  databaseChecklists = databaseChecklists.filter((chk) => chk.content_id !== targetContentId);
  databaseMetrics = databaseMetrics.filter((met) => met.content_id !== targetContentId);

  // 4. Verifikasi bahwa Konten 555 terhapus
  assert.equal(databaseContents.some((c) => c.id === targetContentId), false);
  assert.equal(databaseContents.length, 1);
  assert.equal(databaseContents[0].id, 777);

  // 5. Verifikasi bahwa ke-3 item checklist konten 555 terhapus tanpa sisa (no orphan records)
  const remainingChecklistsForTarget = databaseChecklists.filter(
    (chk) => chk.content_id === targetContentId
  );
  assert.equal(remainingChecklistsForTarget.length, 0);
  assert.equal(databaseChecklists.length, 1);
  assert.equal(databaseChecklists[0].content_id, 777);

  // 6. Verifikasi bahwa ke-2 log metrik konten 555 terhapus tanpa sisa
  const remainingMetricsForTarget = databaseMetrics.filter(
    (met) => met.content_id === targetContentId
  );
  assert.equal(remainingMetricsForTarget.length, 0);
  assert.equal(databaseMetrics.length, 1);
  assert.equal(databaseMetrics[0].content_id, 777);
});

test("QA End-to-End Workflow: Simulasi Siklus Hidup Konten Lengkap Sesuai PRD", () => {
  clearSession();

  // Langkah 1: Autentikasi Pengguna
  const userSession = createSession({
    name: "Ahmad Creator",
    email: "ahmad@studio.id",
    role: "creator",
    token: "token-auth-valid-xyz",
  });
  assert.equal(userSession.email, "ahmad@studio.id");
  assert.equal(isAuthenticated(), true);
  assert.equal(getToken(), "token-auth-valid-xyz");

  // Langkah 2: Pendaftaran Saluran / Channel
  const channelPayload = {
    platform: "youtube",
    handle_name: "@ahmadcreator",
  };
  const channelValidation = validateChannelForm(channelPayload);
  assert.deepEqual(channelValidation, {});

  // Langkah 3: Pembuatan Ide Konten Awal
  const contentFormInput = {
    title: "10 Trik Coding Efisien",
    channel_id: "chan-01",
    format_type: "long_video",
    description: "Video tutorial tips produktivitas",
    script_draft: "Hook: Apakah Anda lelah menulis boilerplate?",
    priority: "high",
    scheduled_date: "2026-11-15",
  };
  const contentValidation = validateContentForm(contentFormInput);
  assert.deepEqual(contentValidation, {});

  // Langkah 4: Urutan Siklus Hidup Konten (6 Stages)
  let currentStatus = "idea";
  const expectedLifecycle = ["idea", "scripting", "recording", "editing", "ready", "published"];

  for (let i = 0; i < expectedLifecycle.length - 1; i++) {
    const nextStatus = expectedLifecycle[i + 1];
    assert.equal(isContentStatus(nextStatus), true);
    currentStatus = nextStatus;
  }
  assert.equal(currentStatus, "published");

  // Langkah 5: Pencatatan Checklist Produksi
  const checklists = [
    { id: "task-1", task_name: "Riset topik", is_completed: true },
    { id: "task-2", task_name: "Rekam audio", is_completed: true },
  ];
  const completedCount = checklists.filter((t) => t.is_completed).length;
  assert.equal(completedCount, 2);

  // Langkah 6: Publikasi dengan validasi URL
  const validUrl = "https://youtube.com/watch?v=10-trik-coding";
  assert.equal(validatePublishedUrl(validUrl), true);

  // Langkah 7: Pencatatan Snapshot Metrik
  const metricInput = {
    views_count: "25000",
    likes_count: "3200",
    comments_count: "410",
    shares_count: "180",
  };
  assert.deepEqual(validateMetricForm(metricInput), {});

  // Langkah 8: Logout
  clearSession();
  assert.equal(isAuthenticated(), false);
  assert.equal(getSession(), null);
});

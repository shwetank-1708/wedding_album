import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaRouter } from "../src/routes/media.js";

function mockRequestResponse(path: string, body: Record<string, any>) {
  const req = {
    method: "POST",
    url: path,
    body,
    header: () => "",
    get: () => "",
    headers: {},
  } as any;

  let statusCode = 200;
  let responseData: any = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    setHeader() { return res; },
  } as any;

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

test("mobile media endpoints input validation without network socket", async () => {
  // Find route layer handlers
  const findHandler = (path: string) => {
    const layer = (mediaRouter.stack as any[]).find(
      (l) => l.route && l.route.path === path && l.route.methods.post
    );
    if (!layer) throw new Error(`Route not found: ${path}`);
    return layer.route.stack[0].handle;
  };

  const getUrlHandler = findHandler("/mobile/get-upload-url");
  const reconcileHandler = findHandler("/mobile/reconcile-upload");
  const saveBatchHandler = findHandler("/mobile/save-photo-batch");

  // 1. /get-upload-url rejects missing eventId
  const ctx1 = mockRequestResponse("/mobile/get-upload-url", {});
  await getUrlHandler(ctx1.req, ctx1.res, () => {});
  assert.equal(ctx1.getStatus(), 400);
  assert.equal(ctx1.getData()?.error, "Missing eventId");

  // 2. /reconcile-upload rejects missing clientUploadId
  const ctx2 = mockRequestResponse("/mobile/reconcile-upload", {});
  await reconcileHandler(ctx2.req, ctx2.res, () => {});
  assert.equal(ctx2.getStatus(), 400);
  assert.equal(ctx2.getData()?.error, "Missing clientUploadId or storageKey");

  // 3. /save-photo-batch rejects missing photos
  const ctx3 = mockRequestResponse("/mobile/save-photo-batch", {});
  await saveBatchHandler(ctx3.req, ctx3.res, () => {});
  assert.equal(ctx3.getStatus(), 400);
  assert.equal(ctx3.getData()?.error, "Missing photos array");
});

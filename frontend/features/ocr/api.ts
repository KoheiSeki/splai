import {
  getOcrJobApiOcrJobsJobIdGet,
  OcrJobResponse,
  OcrUploadResponse,
  uploadReceiptApiGroupsGroupIdOcrUploadPost,
} from '@/lib/api/gen';

// feature 境界として型を再 export(callers が `@/features/ocr/api` 一本で済むように)。
export type { OcrJobResponse, OcrUploadResponse };

/** レシート画像をアップロードし jobId を取得 */
export async function uploadReceipt(
  groupId: string,
  memberId: string,
  file: File,
): Promise<OcrUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return await uploadReceiptApiGroupsGroupIdOcrUploadPost(
    groupId,
    formData as unknown as Parameters<typeof uploadReceiptApiGroupsGroupIdOcrUploadPost>[1],
    { 'X-Member-Id': memberId },
  );
}

/** ジョブの現状を取得する(認証不要 / read op)。 */
export async function getOcrJob(jobId: string): Promise<OcrJobResponse> {
  return await getOcrJobApiOcrJobsJobIdGet(jobId);
}

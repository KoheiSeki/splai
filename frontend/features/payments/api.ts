import { createPaymentApiGroupsGroupIdPaymentsPost } from '@/lib/api/gen/clients/paymentsController/createPaymentApiGroupsGroupIdPaymentsPost';
import { deletePaymentApiGroupsGroupIdPaymentsPaymentIdDelete } from '@/lib/api/gen/clients/paymentsController/deletePaymentApiGroupsGroupIdPaymentsPaymentIdDelete';
import {
  CreatePaymentApiGroupsGroupIdPaymentsPostMutationRequest,
  CreatePaymentApiGroupsGroupIdPaymentsPostMutationResponse,
} from '@/lib/api/gen/types';

export type CreatePaymentInput = CreatePaymentApiGroupsGroupIdPaymentsPostMutationRequest;
export type CreatePaymentResponse = CreatePaymentApiGroupsGroupIdPaymentsPostMutationResponse;

/**
 * 支払いを作成する
 * @param groupId - グループID
 * @param memberId - メンバーID
 * @param input - 支払い入力
 * @returns - 支払いレスポンス
 */
export async function createPayment(
  groupId: string,
  memberId: string,
  input: CreatePaymentInput,
): Promise<CreatePaymentResponse> {
  return await createPaymentApiGroupsGroupIdPaymentsPost(groupId, input, {
    'X-Member-Id': memberId,
  });
}

/**
 * 支払いを削除する
 * @param groupId - グループID
 * @param paymentId - 支払いID
 * @param memberId - メンバーID
 * @returns - 支払い削除レスポンス
 */
export async function deletePayment(
  groupId: string,
  paymentId: string,
  memberId: string,
): Promise<void> {
  return await deletePaymentApiGroupsGroupIdPaymentsPaymentIdDelete(groupId, paymentId, {
    'X-Member-Id': memberId,
  });
}

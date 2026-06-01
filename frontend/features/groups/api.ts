'use client';
import { createGroupApiGroupsPost } from '@/lib/api/gen/clients/groupsController/createGroupApiGroupsPost';
import type {
  CreateGroupApiGroupsPostMutationRequest,
  CreateGroupApiGroupsPostMutationResponse,
} from '@/lib/api/gen/types/groupsController/CreateGroupApiGroupsPost';

// kubb の長い型名を feature 内で短くエイリアスして UI から使いやすく
export type CreateGroupInput = CreateGroupApiGroupsPostMutationRequest;
export type CreateGroupResponse = CreateGroupApiGroupsPostMutationResponse;

// kubb 生成 client は data 部分を直接返す(ResponseConfig.data の中身のみ取り出した値)。
// feature 側は薄くラップして関数名を短くするだけで、戻り値の整形は不要。
export async function createGroup(input: CreateGroupInput): Promise<CreateGroupResponse> {
  return createGroupApiGroupsPost(input);
}

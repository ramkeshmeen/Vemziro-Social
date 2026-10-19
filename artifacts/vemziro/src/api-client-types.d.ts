import '@workspace/api-client-react';
import type { QueryKey, UseMutationResult, UseQueryResult } from '@tanstack/react-query';

declare module '@workspace/api-client-react' {
  export interface ProfileSummary {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  }
  export interface Profile extends ProfileSummary {
    bio: string | null;
    postsCount: number;
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
  }
  export interface Post {
    id: number;
    caption: string | null;
    mediaPath: string;
    mediaType: 'image' | 'video';
    createdAt: string;
    author: ProfileSummary;
    likesCount: number;
    commentsCount: number;
    likedByMe: boolean;
  }
  export interface Comment {
    id: number;
    text: string;
    createdAt: string;
    author: ProfileSummary;
  }
  export interface ProfilePage {
    profile: Profile;
    posts: Post[];
  }
  export interface ProfileUpdate {
    username: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
  }
  export interface LikeResult { liked: boolean; likesCount: number }
  export interface UploadUrlResponse { uploadURL: string; objectPath: string }
  export interface GetFeedParams { scope?: 'all' | 'following' }

  export function getGetMyProfileQueryKey(): QueryKey;
  export function getGetFeedQueryKey(params?: GetFeedParams): QueryKey;
  export function getGetProfileQueryKey(username: string): QueryKey;
  export function getGetProfileSuggestionsQueryKey(): QueryKey;
  export function getGetCommentsQueryKey(postId: number): QueryKey;
  export function getGetStorageObjectQueryKey(objectPath: string): QueryKey;

  export function useGetMyProfile(options?: unknown): UseQueryResult<Profile>;
  export function useGetFeed(params?: GetFeedParams, options?: unknown): UseQueryResult<Post[]>;
  export function useGetProfileSuggestions(options?: unknown): UseQueryResult<Profile[]>;
  export function useGetProfile(username: string, options?: unknown): UseQueryResult<ProfilePage>;
  export function useGetComments(postId: number, options?: unknown): UseQueryResult<Comment[]>;
  export function useGetStorageObject(objectPath: string, options?: unknown): UseQueryResult<Blob>;

  export function useToggleFollow(): UseMutationResult<{ following: boolean }, Error, { username: string }>;
  export function useToggleLike(): UseMutationResult<LikeResult, Error, { postId: number }>;
  export function useCreatePost(): UseMutationResult<Post, Error, { data: { mediaPath: string; mediaType: 'image' | 'video'; caption: string | null } }>;
  export function useCreateComment(): UseMutationResult<Comment, Error, { postId: number; data: { text: string } }>;
  export function useRequestUploadUrl(): UseMutationResult<UploadUrlResponse, Error, { data: { name: string; size: number; contentType: string } }>;
  export function useUpdateMyProfile(): UseMutationResult<Profile, Error, { data: ProfileUpdate }>;
}

import { describe, expect, it } from 'vitest';
import { ownedMediaPath, validateMedia } from './media-rules';
describe('private fault media', () => {
 it('keeps attachments within the current account and conversation', () => {
  expect(ownedMediaPath('operator/thread/file.mp4','operator','thread')).toBe(true);
  expect(ownedMediaPath('other/thread/file.mp4','operator','thread')).toBe(false);
  expect(ownedMediaPath('operator/other/file.mp4','operator','thread')).toBe(false);
 });
 it('accepts whole videos and voice notes', () => {
  expect(validateMedia('video/mp4',1024)).toBe('video');
  expect(validateMedia('audio/wav',1024)).toBe('audio');
  expect(()=>validateMedia('video/mp4',21*1024*1024)).toThrow();
 });
});

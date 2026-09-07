import {
  compactCount,
  followerLabel,
  followingLabel,
  friendLabel,
  postLabel,
  profileStatLine,
} from '../compactCount';

describe('compactCount', () => {
  it('leaves small numbers alone and folds thousands the way the reference does', () => {
    expect(compactCount(0)).toBe('0');
    expect(compactCount(1)).toBe('1');
    expect(compactCount(866)).toBe('866');
    expect(compactCount(999)).toBe('999');
    expect(compactCount(1000)).toBe('1K');
    expect(compactCount(1100)).toBe('1.1K');
    expect(compactCount(1700)).toBe('1.7K');
    expect(compactCount(10_400)).toBe('10K');
    expect(compactCount(1_000_000)).toBe('1M');
    expect(compactCount(2_300_000)).toBe('2.3M');
  });

  it('does not invent a count from a bad number', () => {
    expect(compactCount(-4)).toBe('0');
    expect(compactCount(Number.NaN)).toBe('0');
  });
});

describe('profileStatLine', () => {
  it('pluralises friends the way followers and posts are pluralised', () => {
    expect(friendLabel(0)).toBe('0 friends');
    expect(friendLabel(1)).toBe('1 friend');
    expect(friendLabel(2400)).toBe('2.4K friends');
  });

  it('joins followers, following and posts with a middle dot', () => {
    expect(profileStatLine(1100, 866, 1700)).toBe('1.1K followers · 866 following · 1.7K posts');
    expect(profileStatLine(0, 0, 0)).toBe('0 followers · 0 following · 0 posts');
    expect(profileStatLine(1, 1, 1)).toBe('1 follower · 1 following · 1 post');
  });

  it('labels each noun on its own', () => {
    expect(followerLabel(1)).toBe('1 follower');
    expect(followingLabel(1)).toBe('1 following');
    expect(postLabel(1)).toBe('1 post');
  });
});

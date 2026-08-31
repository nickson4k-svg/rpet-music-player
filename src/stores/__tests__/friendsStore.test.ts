import { describe, it, expect, beforeEach } from 'vitest';
import { useFriendsStore, cleanUsernameToPeerId } from '../friendsStore';

describe('useFriendsStore & cleanUsernameToPeerId', () => {
  beforeEach(() => {
    useFriendsStore.setState({
      friends: [],
      recentPeers: [],
    });
  });

  describe('cleanUsernameToPeerId helper', () => {
    it('formats plain usernames with rpet-user- prefix', () => {
      expect(cleanUsernameToPeerId('SoundMaster')).toBe('rpet-user-soundmaster');
      expect(cleanUsernameToPeerId('DJ Cool')).toBe('rpet-user-dj_cool');
    });

    it('preserves existing rpet-user- prefixes', () => {
      expect(cleanUsernameToPeerId('rpet-user-host123')).toBe('rpet-user-host123');
    });

    it('preserves raw UUIDs', () => {
      const uuid = 'c4a5b6c7-d8e9-4f01-a234-56789abcdef0';
      expect(cleanUsernameToPeerId(uuid)).toBe(uuid);
    });
  });

  describe('friends management', () => {
    it('adds friend successfully and prevents duplicates', () => {
      const { addFriend } = useFriendsStore.getState();

      const res1 = addFriend('BassBooster', 'Bass Friend');
      expect(res1.success).toBe(true);

      const friends = useFriendsStore.getState().friends;
      expect(friends.length).toBe(1);
      expect(friends[0].username).toBe('BassBooster');
      expect(friends[0].nickname).toBe('Bass Friend');
      expect(friends[0].peerId).toBe('rpet-user-bassbooster');

      // Duplicate add
      const res2 = addFriend('bassbooster');
      expect(res2.success).toBe(false);
      expect(res2.message).toBe('Цей друг вже є у вашому списку');
    });

    it('rejects short usernames', () => {
      const { addFriend } = useFriendsStore.getState();
      const res = addFriend('a');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Нікнейм має містити щонайменше 2 символи');
    });

    it('removes friend by username or peerId', () => {
      const { addFriend, removeFriend } = useFriendsStore.getState();
      addFriend('FriendOne');
      addFriend('FriendTwo');
      expect(useFriendsStore.getState().friends.length).toBe(2);

      removeFriend('FriendOne');
      expect(useFriendsStore.getState().friends.length).toBe(1);
      expect(useFriendsStore.getState().friends[0].username).toBe('FriendTwo');
    });

    it('generates invite links with room code', () => {
      const { getDirectRoomInviteLink } = useFriendsStore.getState();
      const link = getDirectRoomInviteLink('my-party-room', 'TargetFriend');
      expect(link).toContain('join=my-party-room');
    });
  });
});

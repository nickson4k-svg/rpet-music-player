import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PartyModeModal } from '../PartyModeModal';
import { useLiveKitStore } from '../../stores/livekitStore';
import { useAuthStore } from '../../stores/authStore';
import { useFriendsStore } from '../../stores/friendsStore';

describe('PartyModeModal (UI/UX & LiveKit Integration)', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    useAuthStore.setState({
      user: { username: 'TestDJ', peer_id: 'rpet-user-testdj' },
    });
    useLiveKitStore.setState({
      status: 'disconnected',
      isHost: false,
      members: [],
      sharedQueue: [],
      chatMessages: [],
      error: null,
      awaitingUserGesture: false,
    });
    useFriendsStore.setState({
      friends: [{ username: 'CoolFriend', peerId: 'rpet-user-coolfriend', addedAt: Date.now() }],
      recentPeers: [],
    });
  });

  it('renders header, title and VIP profile badge', () => {
    render(<PartyModeModal onClose={mockOnClose} />);
    expect(screen.getByText('Спільне прослуховування')).toBeInTheDocument();
    expect(screen.getByText('LiveKit SFU')).toBeInTheDocument();
    expect(screen.getAllByText('TestDJ').length).toBeGreaterThanOrEqual(1);
  });

  it('switches between Queue, Chat, and Search tabs', () => {
    render(<PartyModeModal onClose={mockOnClose} />);

    // Queue tab is active by default
    expect(screen.getByText('Спільна черга порожня')).toBeInTheDocument();

    // Switch to Chat tab by clicking the segmented control button
    const chatTabBtn = screen.getByText('Чат');
    fireEvent.click(chatTabBtn);
    expect(screen.getByPlaceholderText('Напишіть повідомлення в кімнату...')).toBeInTheDocument();

    // Switch to Search tab
    const searchTabBtn = screen.getByText('Пошук треку');
    fireEvent.click(searchTabBtn);
    expect(screen.getByPlaceholderText('Пошук треку через SoundCloud & Audius...')).toBeInTheDocument();
  });

  it('invokes onClose when close button clicked', () => {
    render(<PartyModeModal onClose={mockOnClose} />);
    const closeBtn = screen.getByTitle('Закрити');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders friends list and allows typing in friend search', () => {
    render(<PartyModeModal onClose={mockOnClose} />);
    expect(screen.getByText('CoolFriend')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Пошук або додати друга за ніком...');
    fireEvent.change(searchInput, { target: { value: 'Cool' } });
    expect(screen.getByText('CoolFriend')).toBeInTheDocument();
  });
});

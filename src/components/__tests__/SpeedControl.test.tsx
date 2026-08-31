import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeedControl } from '../Player/SpeedControl';
import { usePlayerStore } from '../../stores/playerStore';

describe('SpeedControl Component', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      playbackRate: 1,
    });
  });

  it('renders current playback speed', () => {
    render(<SpeedControl />);
    expect(screen.getByText('1x')).toBeInTheDocument();
  });

  it('opens popover and allows selecting different speeds', () => {
    render(<SpeedControl />);
    const button = screen.getByTitle('Швидкість відтворення');
    fireEvent.click(button);

    expect(screen.getByText('1.5x')).toBeInTheDocument();
    expect(screen.getByText('2x')).toBeInTheDocument();

    fireEvent.click(screen.getByText('1.5x'));
    expect(usePlayerStore.getState().playbackRate).toBe(1.5);
    expect(screen.getByText('1.5x')).toBeInTheDocument();
  });
});

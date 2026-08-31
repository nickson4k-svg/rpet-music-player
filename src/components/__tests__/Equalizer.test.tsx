import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Equalizer } from '../Player/Equalizer';
import { audioContextState } from '../../utils/audioContext';

describe('Equalizer Component & Audio Node Gain sync', () => {
  beforeEach(() => {
    audioContextState.bassNode = { gain: { value: 0 } } as any;
    audioContextState.midNode = { gain: { value: 0 } } as any;
    audioContextState.trebleNode = { gain: { value: 0 } } as any;
    audioContextState.reverbGainNode = { gain: { value: 0 } } as any;
  });

  it('renders equalizer toggle button', () => {
    render(<Equalizer />);
    expect(screen.getByTitle('Еквалайзер')).toBeInTheDocument();
  });

  it('opens panel and applies EQ presets', () => {
    render(<Equalizer />);
    const btn = screen.getByTitle('Еквалайзер');
    fireEvent.click(btn);

    expect(screen.getByText('Пресет')).toBeInTheDocument();
    expect(screen.getByText('Бас')).toBeInTheDocument();

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Bass Boost' } });
    expect(audioContextState.bassNode?.gain.value).toBe(10);
  });
});

import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// ─── Web Audio API Mocks ───────────────────────────────────────────────────────

class MockAudioNode {
  connect() {
    return this;
  }
  disconnect() {}
}

class MockGainNode extends MockAudioNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'peaking';
  frequency = { value: 1000, setValueAtTime: vi.fn() };
  gain = { value: 0, setValueAtTime: vi.fn() };
  Q = { value: 1, setValueAtTime: vi.fn() };
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 2048;
  frequencyBinCount = 1024;
  minDecibels = -100;
  maxDecibels = -30;
  smoothingTimeConstant = 0.8;
  getByteFrequencyData(array: Uint8Array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  getByteTimeDomainData(array: Uint8Array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = 128;
    }
  }
}

class MockAudioContext {
  state = 'running';
  sampleRate = 44100;
  currentTime = 0;
  destination = new MockAudioNode();

  createGain() {
    return new MockGainNode();
  }
  createBiquadFilter() {
    return new MockBiquadFilterNode();
  }
  createAnalyser() {
    return new MockAnalyserNode();
  }
  createMediaElementSource() {
    return new MockAudioNode();
  }
  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  decodeAudioData(_data: ArrayBuffer, successCallback?: (b: any) => void) {
    const mockBuffer = {
      duration: 180,
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(1024),
    };
    if (successCallback) successCallback(mockBuffer);
    return Promise.resolve(mockBuffer);
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

(window as any).AudioContext = MockAudioContext;
(window as any).webkitAudioContext = MockAudioContext;

// ─── HTMLMediaElement Mocks ───────────────────────────────────────────────────

window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = vi.fn();
window.HTMLMediaElement.prototype.load = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// ─── DOM API Mocks ────────────────────────────────────────────────────────────

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(window as any).ResizeObserver = MockResizeObserver;

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(window as any).IntersectionObserver = MockIntersectionObserver;

if (!crypto.randomUUID) {
  (crypto as any).randomUUID = () => 'test-uuid-' + Math.random().toString(36).substring(2, 9);
}

// ─── Notification & Clipboard Mock ────────────────────────────────────────────

Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

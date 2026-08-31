import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';

describe('useAuthStore (Authentication, Profiles & Validation)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accounts: {},
    });
  });

  it('should initialize with null user and empty accounts', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accounts).toEqual({});
  });

  it('setUsername: sets valid username and generates safe peer_id', () => {
    const { setUsername } = useAuthStore.getState();
    setUsername('Alex_DJ');

    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user?.username).toBe('Alex_DJ');
    expect(state.user?.peer_id).toBe('rpet-user-alex_dj');
  });

  it('setUsername: throws error on short or invalid username', () => {
    const { setUsername } = useAuthStore.getState();
    expect(() => setUsername('a')).toThrow('Нікнейм має містити щонайменше 2 символи');
    expect(() => setUsername('   ')).toThrow('Нікнейм має містити щонайменше 2 символи');
    expect(() => setUsername('!@#$')).toThrow('Нікнейм містить неприпустимі символи');
  });

  it('register & login: allows user creation and authentication', () => {
    const { register, login, logout } = useAuthStore.getState();

    register('testuser', 'secretpass');
    expect(useAuthStore.getState().user?.username).toBe('testuser');

    logout();
    expect(useAuthStore.getState().user).toBeNull();

    login('testuser', 'secretpass');
    expect(useAuthStore.getState().user?.username).toBe('testuser');
  });

  it('login: rejects invalid credentials', () => {
    const { register, login } = useAuthStore.getState();
    register('testuser', 'secretpass');

    expect(() => login('testuser', 'wrongpass')).toThrow('Неправильний пароль');
    expect(() => login('nonexistent', 'secretpass')).toThrow('Користувача не знайдено');
  });
});

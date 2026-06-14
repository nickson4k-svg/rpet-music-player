import { useEffect } from 'react';
import { MainLayout } from './components/Layout/MainLayout';
import { useAuthStore } from './stores/authStore';

function App() {
  const initialize = useAuthStore(state => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <MainLayout />
  );
}

export default App;

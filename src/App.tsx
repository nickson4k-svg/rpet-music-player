
import { MainLayout } from './components/Layout/MainLayout';


function App() {
  

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <MainLayout />
  );
}

export default App;

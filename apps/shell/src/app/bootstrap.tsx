import { createRoot } from 'react-dom/client';
import App from './App';

const el = document.getElementById('root');
if (!el) throw new Error('index.html has no #root element');
createRoot(el).render(<App />);

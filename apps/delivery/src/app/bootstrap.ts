import { mount } from './mount';
import { standaloneContext } from './standalone';

// The standalone page boots the same `mount` the shell can call (D10), with a stand-in host context.
const el = document.getElementById('root');
if (!el) throw new Error('index.html has no #root element');
mount(el, standaloneContext());

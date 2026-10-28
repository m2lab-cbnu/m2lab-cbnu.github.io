// Computes demagnetizing kernels off the main thread.
import { demagKernelFFT } from '../physics/demag.js';
self.onmessage = (e) => {
  const { id, g } = e.data;
  try {
    const K = demagKernelFFT(g.Nx, g.Ny, g.dx, g.dy, g.dz, 48, g.pbc || [0, 0]);
    self.postMessage({ id, K }, [K.data.buffer]);
  } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};

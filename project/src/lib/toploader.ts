import NProgress from "nprogress";

let activeCount = 0;
let progressTimeout: any = null;

export function startProgress() {
  activeCount++;
  if (activeCount === 1) {
    if (progressTimeout) clearTimeout(progressTimeout);
    progressTimeout = setTimeout(() => {
      NProgress.start();
    }, 150);
  }
}

export function stopProgress() {
  activeCount = Math.max(0, activeCount - 1);
  if (activeCount === 0) {
    if (progressTimeout) {
      clearTimeout(progressTimeout);
      progressTimeout = null;
    }
    NProgress.done();
  }
}

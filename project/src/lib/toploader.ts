import NProgress from "nprogress";

let activeCount = 0;

export function startProgress() {
  activeCount++;
  if (activeCount === 1) {
    NProgress.start();
  }
}

export function stopProgress() {
  activeCount = Math.max(0, activeCount - 1);
  if (activeCount === 0) {
    NProgress.done();
  }
}

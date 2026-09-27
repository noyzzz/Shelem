export const googleScriptLoader = (() => {
  let promise: Promise<void> | null = null;
  return () => {
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        const element = document.createElement("script");
        element.src = "https://accounts.google.com/gsi/client";
        element.async = true;
        element.onload = () => resolve();
        element.onerror = () =>
          reject(new Error("Unable to load Google sign-in."));
        document.head.appendChild(element);
      });
    }
    return promise;
  };
})();

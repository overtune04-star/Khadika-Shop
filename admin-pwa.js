(() => {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(() => {});
    });
  }

  const installButton = document.querySelector("[data-install-app]");
  if (!installButton) return;

  let installPrompt;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.classList.remove("hidden");
  });

  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.classList.add("hidden");
  });
})();

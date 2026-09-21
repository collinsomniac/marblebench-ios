// Keep the initial entry small and show an actionable error if a cached or
// interrupted dynamic chunk cannot load. Runtime errors are handled by main.
import("./main.js").catch((error) => {
  console.error(error);
  document.getElementById("phase").textContent =
    "The application could not load. Check your connection and try again.";
  const retry = document.getElementById("retry");
  retry.hidden = false;
  retry.onclick = () => location.reload();
});

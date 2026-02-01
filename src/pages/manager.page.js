function openSettingsPanel() {
  // Manager page has this card but it's hidden by default. :contentReference[oaicite:1]{index=1}
  const card = document.getElementById("companySettingsCard");
  if (card) {
    // Show it
    card.style.display = "block";

    // Scroll to it
    card.scrollIntoView({ behavior: "smooth", block: "start" });

    // Nice UX
    if (typeof window.showMessage === "function") {
      window.showMessage("Settings opened.", "info");
    }
    return;
  }

  // Fallback: if you later move settings into a modal, we’ll replace this.
  if (typeof window.showMessage === "function") {
    window.showMessage("Settings panel not found on this page.", "error");
  } else {
    alert("Settings panel not found on this page.");
  }
}

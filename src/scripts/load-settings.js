// load light/dark mode
document.documentElement.setAttribute(
  "data-theme",
  localStorage.getItem("general.theme") || "light",
);

/* Load settings from localStorage */
document.addEventListener("DOMContentLoaded", () => {
  // Load settings from localStorage
  for (const element of document.getElementsByClassName("setting")) {
    const settingName = element.name;
    const savedValue = localStorage.getItem(settingName);
    if (savedValue !== null) {
      if (element.type === "checkbox") {
        element.checked = savedValue === "true";
      } else {
        element.value = savedValue;
      }
    }

    // Save settings to localStorage on change
    element.addEventListener("change", () => {
      const valueToSave =
        element.type === "checkbox" ? element.checked : element.value;
      localStorage.setItem(settingName, valueToSave);
    });
  }
});

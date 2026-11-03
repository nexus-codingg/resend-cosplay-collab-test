export const THEME_STORAGE_KEY = "theme";

// Runs in <head> before first paint so a saved theme never flashes the wrong colors
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

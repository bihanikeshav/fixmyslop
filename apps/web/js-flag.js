// Externalized so dashboard.html's CSP (apps/web/_headers) can keep
// script-src free of 'unsafe-inline'. Enables the .js-gated CSS transitions
// (see the html.js rules in dashboard.html's <style>).
document.documentElement.classList.add("js");

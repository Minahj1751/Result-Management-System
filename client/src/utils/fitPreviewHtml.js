/**
 * Injects a small fit-to-width script/style into server-rendered A4 preview HTML
 * so it scales down inside the preview iframe on small screens.
 * Only affects the preview (PDF generation uses the untouched template).
 */
export function fitPreviewHtml(html) {
  const inject = `<style>
@media screen {
  .page { width: 210mm !important; max-width: none !important; }
  html, body { overflow-x: hidden; }
}
</style>
<script>
(function () {
  var page = document.querySelector('.page');
  if (!page) return;
  function fit() {
    var base = 210 * 96 / 25.4;
    var scale = Math.min(1, (window.innerWidth - 16) / base);
    page.style.zoom = scale > 0 ? scale : 1;
  }
  fit();
  window.addEventListener('resize', fit);
})();
</script>`;
  return html.includes('</body>') ? html.replace('</body>', inject + '</body>') : html + inject;
}

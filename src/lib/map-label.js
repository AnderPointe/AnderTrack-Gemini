// Leaflet treats string tooltip content as HTML, even when sourced from textContent.
export function mapTextLabel(value, ownerDocument = document) {
  const label = ownerDocument.createElement('span');
  label.textContent = String(value ?? '');
  return label;
}

export function AttachmentPlaceholder() {
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
      <label htmlFor="attachment-preview" className="block text-sm font-medium">Attachments (optional)</label>
      <input id="attachment-preview" type="file" disabled aria-describedby="attachment-help" className="block max-w-full text-sm text-muted-foreground" />
      <p id="attachment-help" className="text-sm text-muted-foreground">Uploads are not available in this version. No file is selected, stored, or sent.</p>
    </div>
  );
}

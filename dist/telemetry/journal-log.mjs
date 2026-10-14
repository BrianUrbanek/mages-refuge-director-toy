/** Concise reading/copy view. Full detail remains in exported telemetry. */
export function journalLogEntries(entries) {
  return entries.filter(
    (e) =>
      !["health", "burst", "recovery"].includes(e.kind) &&
      !(e.kind === "fuel" && e.data.reason === "passive"),
  );
}

export function formatJournalLog(entries) {
  return journalLogEntries(entries)
    .map((e) => {
      const seconds = Math.floor(e.time);
      const stamp = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      return `${stamp} [${e.kind}] ${e.text}${e.context.roomName ? ` · ${e.context.roomName}` : ""}`;
    })
    .join("\n");
}

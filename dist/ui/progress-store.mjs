/** Browser persistence is an application concern, never a director dependency. */
export function createProgressStore(storage) {
  let value = { keys: 0, final: false };
  try {
    const saved = JSON.parse(storage.getItem("refuge-progress-v1") || "{}");
    if (Number.isFinite(saved.keys) && saved.keys >= 0) value.keys = saved.keys;
    value.final = Boolean(saved.final);
  } catch {}
  const save = () => {
    try {
      storage.setItem("refuge-progress-v1", JSON.stringify(value));
    } catch {}
  };
  return {
    snapshot: () => ({ ...value }),
    bank: (earned, refuge) => {
      value.keys += earned;
      if (refuge) value.final = true;
      save();
    },
    enterSanctum: () => {
      if (value.keys < 5 || !value.final) return false;
      value.keys -= 5;
      save();
      return true;
    },
  };
}

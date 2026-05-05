"use client";

import { useEffect, useState } from "react";

interface TimeSlot {
  id: string;
  display_label: string;
  sort_key: number;
  active: boolean;
}

interface RecurringBlock {
  id: string;
  day_of_week: number;
  time: string | null;
}

interface Props {
  timeSlots: TimeSlot[];
  recurringBlocks: RecurringBlock[];
  onSave: (blocks: Array<{ day_of_week: number; time: string | null }>) => Promise<void>;
  saving: boolean;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function buildTemplate(blocks: RecurringBlock[]): Map<number, Set<string | null>> {
  const map = new Map<number, Set<string | null>>();
  for (const b of blocks) {
    if (!map.has(b.day_of_week)) map.set(b.day_of_week, new Set());
    map.get(b.day_of_week)!.add(b.time);
  }
  return map;
}

export default function WeeklyTemplateEditor({ timeSlots, recurringBlocks, onSave, saving }: Props) {
  const activeSlots = timeSlots.filter((s) => s.active).sort((a, b) => a.sort_key - b.sort_key);

  // localTemplate[dow] = Set of blocked time labels (null = all day)
  const [localTemplate, setLocalTemplate] = useState<Map<number, Set<string | null>>>(() =>
    buildTemplate(recurringBlocks)
  );

  // Re-sync when prop changes (e.g. after a save)
  useEffect(() => {
    setLocalTemplate(buildTemplate(recurringBlocks));
  }, [recurringBlocks]);

  function toggle(dow: number, time: string | null) {
    setLocalTemplate((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(dow) ?? []);
      if (time === null) {
        // Toggle all-day: if enabling all-day, clear specific times
        if (set.has(null)) set.delete(null);
        else { set.clear(); set.add(null); }
      } else {
        // If all-day is on, toggling a specific time removes all-day first
        if (set.has(null)) set.delete(null);
        if (set.has(time)) set.delete(time);
        else set.add(time);
      }
      if (set.size === 0) next.delete(dow);
      else next.set(dow, set);
      return next;
    });
  }

  function isChecked(dow: number, time: string | null): boolean {
    const set = localTemplate.get(dow);
    if (!set) return false;
    if (time === null) return set.has(null);
    return set.has(null) || set.has(time);
  }

  async function handleSave() {
    if (!window.confirm("This will replace all current recurring rules with this template. Continue?")) return;

    const blocks: Array<{ day_of_week: number; time: string | null }> = [];
    for (const [dow, times] of localTemplate.entries()) {
      for (const time of times) {
        blocks.push({ day_of_week: dow, time });
      }
    }
    await onSave(blocks);
  }

  return (
    <div className="weekly-template">
      <p className="weekly-template-desc">
        Set which times are unavailable every week. Changes replace all current recurring rules.
      </p>
      <div className="weekly-template-grid">
        {Array.from({ length: 7 }, (_, dow) => (
          <div key={dow} className="weekly-template-row">
            <span className="weekly-template-day">{DAY_NAMES[dow]}</span>
            <div className="weekly-template-slots">
              <label className="weekly-template-check">
                <input
                  type="checkbox"
                  checked={isChecked(dow, null)}
                  onChange={() => toggle(dow, null)}
                />
                <span>All day</span>
              </label>
              {activeSlots.map((slot) => (
                <label key={slot.id} className="weekly-template-check">
                  <input
                    type="checkbox"
                    checked={isChecked(dow, slot.display_label)}
                    onChange={() => toggle(dow, slot.display_label)}
                    disabled={isChecked(dow, null)}
                  />
                  <span>{slot.display_label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="weekly-template-footer">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save weekly schedule"}
        </button>
      </div>
    </div>
  );
}

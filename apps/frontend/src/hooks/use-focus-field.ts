import { useEffect } from "react";

/**
 * Focuses (and selects the text of) the input with `id` whenever it
 * changes to a real value — used so the cursor lands on the next useful
 * field right after a scan or a product pick, instead of making the
 * operator reach for the mouse. Pass `null` for "nothing to focus right now".
 */
export function useFocusFieldById(id: string | null) {
  useEffect(() => {
    if (!id) return;
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.focus();
      el.select();
    }
  }, [id]);
}

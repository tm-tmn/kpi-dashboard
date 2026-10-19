import { CheckCircle2 } from "lucide-react";

/** "กรอกแล้ว X/12 เดือน" — how many months of the selected fiscal year
 * already have at least one saved row, for a data source's entry form.
 * Color follows completeness: muted while sparse, success once full. */
export function CompletenessBadge({ filled, total = 12 }: { filled: number; total?: number }) {
  const complete = filled >= total;
  return (
    <div
      className={`badge gap-1.5 border-0 text-xs ${
        complete ? "bg-success/15 text-success" : "bg-base-content/5 text-base-content/50"
      }`}
      title={`บันทึกข้อมูลแล้ว ${filled} จาก ${total} เดือนในปีงบประมาณนี้`}
    >
      {complete && <CheckCircle2 size={12} />}
      กรอกแล้ว {filled}/{total} เดือน
    </div>
  );
}

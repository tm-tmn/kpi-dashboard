import { Droplet, Activity, Stethoscope, ClipboardList, type LucideIcon } from "lucide-react";
import { SERVICE_POINTS, type ServicePoint } from "./constants";

export const POINT_META: Record<
  ServicePoint,
  { icon: LucideIcon; color: string; short: string; palette: string[] }
> = {
  "ห้องเจาะเลือด OPD": {
    icon: Droplet,
    color: "#3DA9FC",
    short: "OPD",
    palette: ["#3DA9FC", "#7CC4FD", "#1C7FD6", "#A9D9FE", "#155A94", "#5ED1FF"],
  },
  "ห้องเจาะเลือด กว.": {
    icon: Activity,
    color: "#34D399",
    short: "กว.",
    palette: ["#34D399", "#6EE7B7", "#0E9F6E", "#A7F3D0", "#0A6847", "#5EEAD4"],
  },
  "ห้องเจาะเลือด SMC": {
    icon: Stethoscope,
    color: "#B794F6",
    short: "SMC",
    palette: ["#B794F6", "#D6BCFA", "#8B5CF6", "#E9D8FD", "#6029C2", "#C4B5FD"],
  },
  "ห้องเจาะเลือดงานเวชกรรมฯ": {
    icon: ClipboardList,
    color: "#F6A75E",
    short: "เวชกรรมฯ",
    palette: ["#F6A75E", "#FBD38D", "#DD7A1F", "#FEEBC8", "#9C5110", "#F6C177"],
  },
};

export function pointMeta(point: string) {
  return (
    POINT_META[point as ServicePoint] ?? {
      icon: Droplet,
      color: "#3DA9FC",
      short: point,
      palette: POINT_META["ห้องเจาะเลือด OPD"].palette,
    }
  );
}

export { SERVICE_POINTS };

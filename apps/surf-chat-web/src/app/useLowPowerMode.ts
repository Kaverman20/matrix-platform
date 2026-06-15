import { useEffect, useState } from "react";

type BatteryLike = {
  charging: boolean;
  level: number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BatteryLike>;
};

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const LOW_BATTERY = 0.3;

/**
 * True when animations should be minimised: the OS "reduce motion" setting is
 * on, OR the device is running on battery and low. Heavy JS-driven animation is
 * the first thing to stutter when the CPU/GPU is throttled on battery, so we
 * switch the UI to instant transitions in those conditions.
 *
 * Note: the Battery API is unavailable in Safari, so there we fall back to the
 * OS reduce-motion preference only.
 */
export function useLowPowerMode(): boolean {
  const [reduce, setReduce] = useState(
    () => typeof matchMedia === "function" && matchMedia(REDUCE_QUERY).matches,
  );

  useEffect(() => {
    const mq = matchMedia(REDUCE_QUERY);
    let battery: BatteryLike | null = null;

    const recompute = () => {
      const lowBattery = battery ? !battery.charging && battery.level <= LOW_BATTERY : false;
      setReduce(mq.matches || lowBattery);
    };

    mq.addEventListener("change", recompute);

    const nav = navigator as NavigatorWithBattery;
    nav.getBattery?.().then((b) => {
      battery = b;
      b.addEventListener("levelchange", recompute);
      b.addEventListener("chargingchange", recompute);
      recompute();
    });

    return () => {
      mq.removeEventListener("change", recompute);
      battery?.removeEventListener("levelchange", recompute);
      battery?.removeEventListener("chargingchange", recompute);
    };
  }, []);

  return reduce;
}

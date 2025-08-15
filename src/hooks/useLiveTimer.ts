import type { RestTimerState } from "@/jazz/schema";
import type { co } from "jazz-tools";
import { Duration } from "luxon";
import { useEffect, useMemo, useState } from "react";

type TimerValues = {
  timeLeftMs: number;
  displayTime: string;
  remainingPercentage: number;
};

const formatTime = (ms: number) => {
    const isNegative = ms < 0;
    const duration = Duration.fromMillis(Math.abs(ms));
    const formattedTime = duration.toFormat('m:ss');
    return isNegative ? `-${formattedTime}` : formattedTime;
};

export function useLiveTimer(timer: co.loaded<typeof RestTimerState> | null | undefined): TimerValues {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        if (!timer || timer.isPaused) {
            return;
        }

        const intervalId = setInterval(() => {
            setNow(new Date());
        }, 1000);

        return () => clearInterval(intervalId);
    }, [timer]);

    return useMemo(() => {
        if (!timer) {
            return { timeLeftMs: 0, displayTime: "0:00", remainingPercentage: 0 };
        }

        const calculationDate = new Date();

        let timeLeftMs: number;
        if (timer.isPaused && timer.pauseTime) {
            timeLeftMs = timer.endTime.getTime() - timer.pauseTime.getTime();
        } else {
            timeLeftMs = timer.endTime.getTime() - calculationDate.getTime();
        }

        const totalDurationMs = timer.initialDuration * 1000;
        const remainingPercentage = totalDurationMs <= 0 ? 0 :
            Math.max(0, Math.min(100, (timeLeftMs / totalDurationMs) * 100));

        return {
            timeLeftMs,
            displayTime: formatTime(timeLeftMs),
            remainingPercentage,
        };
    }, [timer, now]);
}

export const calculateEpley1RM = (weight: number, reps: number, rir = 0): number => {
    if (!weight || !reps || reps < 1) return 0;
    const effectiveReps = reps + rir;
    if (effectiveReps <= 1) return weight;
    return weight * (1 + effectiveReps / 30);
};

export const getWeightForReps = (oneRepMax: number, reps: number): number => {
    if (!oneRepMax || !reps || oneRepMax <= 0) return 0;
    return oneRepMax / (1 + reps / 30);
};

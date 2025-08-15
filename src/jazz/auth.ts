import { co } from "jazz-tools"; 
import { WorkoutAppAccount } from "./schema";

type LoadedWorkoutAppAccount = co.loaded<typeof WorkoutAppAccount, {
    root: {
        plans: { $each: { days: { $each: { exercises: { $each: true } } } } };
        sessions: { $each: { exercises: { $each: { sets: { $each: true } } } } };
    }
}>;

export async function onAnonymousAccountDiscarded(anonymousAccount: LoadedWorkoutAppAccount) {
    
    const { root: anonymousRoot } = await anonymousAccount.$jazz.ensureLoaded({
            resolve: {
                root: {
                    plans: { $each: { days: { $each: { exercises: { $each: true } } } } },
                    sessions: { $each: { exercises: { $each: { sets: { $each: true } } } } },
                }
            }
        });

    
    const me = await WorkoutAppAccount.getMe().$jazz.ensureLoaded({
            resolve: {
                root: {
                    plans: true,
                    sessions: true,
                }
            }
        });

    
    if (anonymousRoot.plans && anonymousRoot.plans.length > 0) {
        for (const plan of anonymousRoot.plans) {
            if (!plan) continue;
            
            plan.$jazz.owner.addMember(me, "admin");
            
            me.root.plans.$jazz.push(plan);
            
            
            for (const day of plan.days || []) {
                if (!day) continue;
                day.$jazz.owner.addMember(me, "admin");
                for (const exercise of day.exercises || []) {
                    if (!exercise) continue;
                    exercise.$jazz.owner.addMember(me, "admin");
                }
            }
        }
    }

    
    if (anonymousRoot.sessions && anonymousRoot.sessions.length > 0) {
        for (const session of anonymousRoot.sessions) {
            if (!session) continue;
            
            session.$jazz.owner.addMember(me, "admin");
            
            me.root.sessions.$jazz.push(session);

            
            for (const exercise of session.exercises || []) {
                if (!exercise) continue;
                exercise.$jazz.owner.addMember(me, "admin");
                for (const set of exercise.sets || []) {
                    if (!set) continue;
                    set.$jazz.owner.addMember(me, "admin");
                }
            }
        }
    }
}
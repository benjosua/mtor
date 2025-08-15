
export type Locale = 'en' | 'es' | 'de';

export type EquipmentKey =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'band'
  | 'ezBarbell'
  | 'smithMachine'
  | 'sledMachine'
  | 'trapBar'
  | 'weighted';

export type BodyPartKey = 
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'upperArms'
  | 'lowerArms'
  | 'core'
  | 'upperLegs'
  | 'lowerLegs'
  | 'glutes'
  | 'fullBody'
  | 'cardio';

export type MuscleKey = 
  
  | 'pectoralsMajor'
  | 'pectoralsMinor'
  
  
  | 'latissimusDorsi'
  | 'rhomboids'
  | 'erectorSpinae'
  | 'serratusAnterior'
  | 'teresMajor'
  
  
  | 'deltoidAnterior'
  | 'deltoidLateral'
  | 'deltoidPosterior'
  
  
  | 'supraspinatus'
  | 'infraspinatus'
  | 'teresMinor'
  | 'subscapularis'
  
  
  | 'trapsUpper'
  | 'trapsMiddle'
  | 'trapsLower'
  
  
  | 'sternocleidomastoid'
  
  
  | 'bicepsBrachii'
  | 'brachialis'
  | 'tricepsLongHead'
  | 'tricepsLateralHead'
  | 'tricepsMedialHead'
  
  
  | 'wristFlexors'
  | 'wristExtensors'
  | 'brachioradialis'
  | 'pronators'
  | 'supinators'
  
  
  | 'rectusAbdominis'
  | 'obliques'
  | 'transverseAbdominis'
  
  
  | 'gluteusMaximus'
  | 'gluteusMedius'
  | 'gluteusMinimus'
  
  
  | 'rectusFemoris'
  | 'quadricepsVasti'
  | 'bicepsFemoris'
  | 'semitendinosus'
  | 'semimembranosus'
  | 'hipAdductors'
  | 'hipAbductors'
  | 'hipFlexors'
  | 'sartorius'
  
  
  | 'gastrocnemius'
  | 'soleus'
  | 'tibialisAnterior'
  | 'peroneals'
  
  
  | 'cardio'
  | 'stabilizers';

export interface MasterExercise {
  
  name: { [key in Locale]: string };

  
  bodyPartKey: BodyPartKey;
  equipmentKey: EquipmentKey;

  
  primaryMuscleKeys: MuscleKey[];     
  secondaryMuscleKeys: MuscleKey[];   

  
  force?: 'push' | 'pull' | 'static';

  
  unilateral?: boolean; 
  compound?: boolean;   
  isometric?: boolean;  

  
  instructions: { [key in Locale]: string[] };
}

export type MasterLibrary = Record<string, MasterExercise>;
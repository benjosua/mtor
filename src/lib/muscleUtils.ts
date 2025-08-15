import type { MuscleSlug } from '@/components/BodyAnatomy';
import type { TFunction } from 'i18next';

export const specificToGeneralMuscleMap: Record<string, string> = {
    pectoralsMajor: 'chest', pectoralsMinor: 'chest', latissimusDorsi: 'lats',
    rhomboids: 'upperBack', erectorSpinae: 'lowerBack', teresMajor: 'lats',
    teresMinor: 'upperBack', infraspinatus: 'upperBack', supraspinatus: 'upperBack',
    serratusAnterior: 'chest', deltoidAnterior: 'shoulders', deltoidLateral: 'shoulders',
    deltoidPosterior: 'shoulders', trapsUpper: 'traps', trapsMiddle: 'traps',
    trapsLower: 'traps', bicepsBrachii: 'biceps', brachialis: 'biceps',
    brachioradialis: 'forearms', tricepsLongHead: 'triceps', tricepsLateralHead: 'triceps',
    tricepsMedialHead: 'triceps', wristExtensors: 'forearms', wristFlexors: 'forearms',
    rectusAbdominis: 'abs', obliques: 'obliques', transverseAbdominis: 'core',
    gluteusMaximus: 'glutes', gluteusMedius: 'glutes', gluteusMinimus: 'glutes',
    quadricepsVasti: 'quads', rectusFemoris: 'quads', bicepsFemoris: 'hamstrings',
    semitendinosus: 'hamstrings', semimembranosus: 'hamstrings', hipAbductors: 'hipAbductors',
    hipAdductors: 'hipAdductors', hipFlexors: 'hipFlexors', gastrocnemius: 'calves',
    soleus: 'calves', tibialisAnterior: 'calves', stabilizers: 'core', cardio: 'cardio',
};

export const stretchMediatedHypertrophyMuscles = new Set<string>([
    
    'quadricepsVasti',
    'rectusFemoris',
    
    'bicepsFemoris',
    'semitendinosus',
    'semimembranosus',
    
    'gluteusMaximus',
    
    'pectoralsMajor',
    
    'soleus',
    'gastrocnemius'
]);

export const generalMuscleTranslations = {
    abs: { en: 'Abs', es: 'Abdominales', de: 'Bauchmuskeln' },
    biceps: { en: 'Biceps', es: 'Bíceps', de: 'Bizeps' },
    calves: { en: 'Calves', es: 'Pantorrillas', de: 'Waden' },
    chest: { en: 'Chest', es: 'Pecho', de: 'Brust' },
    core: { en: 'Core', es: 'Core', de: 'Rumpf' },
    forearms: { en: 'Forearms', es: 'Antebrazos', de: 'Unterarme' },
    glutes: { en: 'Glutes', es: 'Glúteos', de: 'Gesäß' },
    hamstrings: { en: 'Hamstrings', es: 'Isquiotibiales', de: 'Beinbeuger' },
    hipAbductors: { en: 'Hip Abductors', es: 'Abductores de cadera', de: 'Hüftabduktoren' },
    hipAdductors: { en: 'Hip Adductors', es: 'Aductores de cadera', de: 'Hüftadduktoren' },
    hipFlexors: { en: 'Hip Flexors', es: 'Flexores de cadera', de: 'Hüftbeuger' },
    lats: { en: 'Lats', es: 'Dorsales', de: 'Latissimus' },
    lowerBack: { en: 'Lower Back', es: 'Espalda Baja', de: 'Unterer Rücken' },
    obliques: { en: 'Obliques', es: 'Oblicuos', de: 'Obliquen' },
    quads: { en: 'Quads', es: 'Cuádriceps', de: 'Quadrizeps' },
    shoulders: { en: 'Shoulders', es: 'Hombros', de: 'Schultern' },
    traps: { en: 'Traps', es: 'Trapecios', de: 'Trapezmuskel' },
    triceps: { en: 'Triceps', es: 'Tríceps', de: 'Trizeps' },
    upperBack: { en: 'Upper Back', es: 'Espalda Alta', de: 'Oberer Rücken' },
    cardio: { en: 'Cardio', es: 'Cardio', de: 'Cardio' },
};

export const libraryKeyToAnatomySlug: Partial<Record<string, MuscleSlug | MuscleSlug[]>> = {
    
    bicepsBrachii: 'biceps',
    brachialis: 'brachialis',
    brachioradialis: 'brachioradialis',

    
    tricepsLateralHead: 'triceps',
    tricepsLongHead: 'triceps',
    tricepsMedialHead: 'triceps',

    
    erectorSpinae: 'lats', 
    infraspinatus: 'trapezius-middle',
    latissimusDorsi: 'lats',
    rhomboids: 'trapezius-middle', 
    serratusAnterior: 'lats',
    subscapularis: 'lats', 
    supraspinatus: 'trapezius-upper',
    teresMajor: 'lats',
    teresMinor: 'lats',

    
    pectoralsMajor: 'pectorals',
    pectoralsMinor: 'pectorals',

    
    obliques: 'obliques',
    rectusAbdominis: 'abdominals',
    transverseAbdominis: 'abdominals',

    
    pronators: 'pronators',
    supinators: 'wrist-extensors', 
    wristExtensors: 'wrist-extensors',
    wristFlexors: 'wrist-flexors',

    
    gastrocnemius: 'gastrocnemius',
    peroneals: 'calves', 
    soleus: 'soleus',
    tibialisAnterior: 'tibialis-anterior',

    
    gluteusMaximus: 'gluteus-maximus',
    gluteusMedius: 'gluteus-maximus',
    gluteusMinimus: 'gluteus-maximus',

    
    bicepsFemoris: 'hamstrings',
    semimembranosus: 'hamstrings',
    semitendinosus: 'hamstrings',

    
    hipAbductors: 'abductors',
    hipAdductors: 'adductors',
    hipFlexors: 'hip-flexors',

    
    quadricepsVasti: 'quadricepsVasti',
    rectusFemoris: 'rectus-femoris',
    sartorius: 'sartorius',

    
    sternocleidomastoid: 'neck',

    
    deltoidAnterior: 'deltoid-anterior',
    deltoidLateral: 'deltoid-lateral',
    deltoidPosterior: 'deltoid-posterior',

    
    trapsLower: 'trapezius-lower',
    trapsMiddle: 'trapezius-middle',
    trapsUpper: 'trapezius-upper',

    
    cardio: 'unknown',
    stabilizers: 'unknown',
};

export function getDisplayMuscleNames({
    specificKeys,
    displayDetailed,
    t,
}: {
    specificKeys: readonly string[];
    displayDetailed: boolean;
    t: TFunction;
}): string[] {
    if (!specificKeys) return [];

    if (displayDetailed) {
        
        return specificKeys.map(key => t(`muscles.${key}`));
    } else {
        
        const generalKeys = new Set<string>();
        for (const key of specificKeys) {
            generalKeys.add(specificToGeneralMuscleMap[key] || key);
        }
        return Array.from(generalKeys).map(key => t(`generalMuscles.${key}`));
    }
}
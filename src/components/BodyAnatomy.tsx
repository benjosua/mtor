import { useMemo, useRef, useState } from 'react';
import { backBodyPartData } from './backBodyPartDataIndexed';
import { frontBodyPartData } from './frontBodyPartDataIndexed';

export type BodyPartView = 'front' | 'back' | 'dual';

export type MuscleSlug =
    | 'outline' | 'feet' | 'ankles' | 'calves' | 'tibialis-anterior' | 'soleus' | 'gastrocnemius'
    | 'quadricepsVasti' | 'rectus-femoris' | 'quadriceps'
    | 'adductors' | 'sartorius' | 'hip-flexors' | 'hands' | 'wrist-flexors'
    | 'wrist-extensors' | 'pronators' | 'brachialis' | 'triceps' | 'brachioradialis' | 'biceps'
    | 'obliques' | 'lats' | 'abdominals'
    | 'deltoid-anterior' | 'deltoid-lateral' | 'deltoid-posterior'
    | 'pectorals' | 'neck'
    | 'trapezius-upper' | 'trapezius-middle' | 'trapezius-lower'
    | 'gluteus-maximus' | 'hamstrings' | 'abductors' | 'unknown';

export interface BodyPartData {
    slug: string; pathArray: string[]; color: string; fillRule?: 'nonzero' | 'evenodd' | 'inherit';
    stroke?: string; strokeWidth?: string; strokeLinecap?: 'butt' | 'round' | 'square' | 'inherit'; strokeLinejoin?: 'miter' | 'round' | 'bevel' | 'inherit';
}

export interface BodyAnatomyProps {
    overrideViewBox?: string | null;
    view: BodyPartView;
    highlightedMuscle?: MuscleSlug | null;
    onMuscleClick?: (slug: MuscleSlug) => void;
    muscleFatigue?: Partial<Record<MuscleSlug, number>>;
    fatigueColor?: string;
    colorScheme?: 'default' | 'grey';
    primaryMuscles?: MuscleSlug[] | null;
    secondaryMuscles?: MuscleSlug[] | null;
    primaryColor?: string;
    secondaryColor?: string;
    showCredit?: boolean;
}

const MUSCLE_SLUG_MAP: { [key: string]: MuscleSlug } = {
    "outline": "outline", "Hands": "hands", "Feet": "feet", "Ankle": "ankles", "Head": "unknown",
    "Tibialis Anterior": "tibialis-anterior", "Soleus": "soleus", "Gastrocnemius": "gastrocnemius",
    "quadricepsVasti": "quadricepsVasti", "rectus-femoris": "rectus-femoris", "Quadriceps": "quadriceps",
    "Hip Adductors": "adductors", "Sartorius": "sartorius",
    "Hip Flexors": "hip-flexors", "Hamstrings": "hamstrings", "Gluteus_Maximus": "gluteus-maximus",
    "Abductors": "abductors", "calves": "calves", "Wrist Flexors": "wrist-flexors",
    "Wrist Extensors": "wrist-extensors", "Pronators": "pronators", "Brachialis": "brachialis",
    "Triceps Brachii": "triceps", "Brachioradialis": "brachioradialis", "Biceps Brachii": "biceps",
    "Obliques": "obliques", "Latissimus Dorsi & Teres Major": "lats", "Rectus Abdominis": "abdominals",
    "Pectoralis Major": "pectorals", "Scalenes": "neck", "Sternocleidomastoid": "neck",
    "Deltoid Anterior": "deltoid-anterior", "Deltoid Medial/Lateral": "deltoid-lateral", "Deltoid Posterior": "deltoid-posterior",
    "Trapezius Upper": "trapezius-upper", "Trapezius Middle": "trapezius-middle", "Trapezius Lower": "trapezius-lower",
};

const FRONT_DEFAULT_VIEWBOX = "0 0 596 1133";
const BACK_DEFAULT_VIEWBOX = "0 0 596 1133";
const DUAL_DEFAULT_VIEWBOX = "0 0 1192 1133";

const BodyPart = ({ part, isPrimary, isSecondary, isSelectable, unifiedSlug, colorScheme, primaryColor, secondaryColor, hoveredSlug, setHoveredSlug, onMuscleClick, hasActiveHighlights, isLegacyHighlighted, muscleFatigue, fatigueColor }: any) => {
    const path = part.pathArray.join(' ');

    let displayColor = part.color;
    if (isPrimary) {
        displayColor = primaryColor;
    } else if (isSecondary) {
        displayColor = secondaryColor;
    } else if (colorScheme === 'grey') {
        if (isSelectable) displayColor = '#BDBDBD';
        else if (unifiedSlug === 'outline' || part.color !== 'none') displayColor = '#E0E0E0';
    }

    const isHovered = hoveredSlug === unifiedSlug;
    const isDimmed = hasActiveHighlights && !isPrimary && !isSecondary && !isLegacyHighlighted && unifiedSlug !== 'outline';
    const opacity = isDimmed ? 0.3 : 1;

    if (displayColor === 'none' && !part.stroke) return null;

    return (
        <g>
            <path
                data-slug={isSelectable ? unifiedSlug : undefined}
                d={path}
                fill={displayColor}
                fillRule={part.fillRule}
                stroke={isHovered && isSelectable ? 'black' : part.stroke}
                strokeWidth={isHovered && isSelectable ? '1.5' : part.strokeWidth}
                strokeLinecap={part.strokeLinecap}
                strokeLinejoin={part.strokeLinejoin}
                onMouseEnter={() => isSelectable && setHoveredSlug(unifiedSlug)}
                onMouseLeave={() => isSelectable && setHoveredSlug(null)}
                onClick={() => isSelectable && onMuscleClick?.(unifiedSlug)}
                style={{
                    opacity: opacity,
                    transition: 'opacity 0.2s ease-in-out, fill 0.2s ease-in-out',
                    cursor: isSelectable ? 'pointer' : 'default',
                }}
            >
                <title>{part.slug} ({unifiedSlug})</title>
            </path>

            {muscleFatigue[unifiedSlug] && isSelectable && (
                <path
                    d={path}
                    fill={fatigueColor}
                    fillOpacity={muscleFatigue[unifiedSlug]}
                    style={{ pointerEvents: 'none' }}
                    fillRule={part.fillRule}
                />
            )}
        </g>
    );
};

export const BodyAnatomy = ({
    overrideViewBox = null,
    view,
    highlightedMuscle = null,
    onMuscleClick,
    muscleFatigue = {},
    fatigueColor = '#ef4444',
    colorScheme = 'default',
    primaryMuscles = [],
    secondaryMuscles = [],
    primaryColor = '#dc2626',
    secondaryColor = '#f97316',
    showCredit = true,
}: BodyAnatomyProps) => {
    const [hoveredSlug, setHoveredSlug] = useState<MuscleSlug | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const defaultViewBox = useMemo(() => {
        if (view === 'front') return FRONT_DEFAULT_VIEWBOX;
        if (view === 'back') return BACK_DEFAULT_VIEWBOX;
        return DUAL_DEFAULT_VIEWBOX;
    }, [view]);

    const primarySet = useMemo(() => new Set(primaryMuscles || []), [primaryMuscles]);
    const secondarySet = useMemo(() => new Set(secondaryMuscles || []), [secondaryMuscles]);

    const dynamicViewBox = overrideViewBox || defaultViewBox;
    const [vbX, vbY, vbWidth, vbHeight] = dynamicViewBox.split(' ').map(Number);
    const hasActiveHighlights = (primaryMuscles && primaryMuscles.length > 0) || (secondaryMuscles && secondaryMuscles.length > 0) || !!highlightedMuscle;

    const renderBodyParts = (data: BodyPartData[]) => {
        return data.map((part, index) => {
            const unifiedSlug = MUSCLE_SLUG_MAP[part.slug] || 'unknown';
            const isSelectable = unifiedSlug !== 'unknown' && unifiedSlug !== 'outline';
            const isPrimary = primarySet.has(unifiedSlug);
            const isSecondary = secondarySet.has(unifiedSlug);
            const isLegacyHighlighted = highlightedMuscle === unifiedSlug;

            return (
                <BodyPart
                    key={`${view}-${part.slug}-${index}`}
                    part={part}
                    isPrimary={isPrimary}
                    isSecondary={isSecondary}
                    isSelectable={isSelectable}
                    unifiedSlug={unifiedSlug}
                    colorScheme={colorScheme}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    hoveredSlug={hoveredSlug}
                    setHoveredSlug={setHoveredSlug}
                    onMuscleClick={onMuscleClick}
                    hasActiveHighlights={hasActiveHighlights}
                    isLegacyHighlighted={isLegacyHighlighted}
                    muscleFatigue={muscleFatigue}
                    fatigueColor={fatigueColor}
                />
            );
        });
    };

    return (
        <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
            <div className="flex flex-col items-center">
                <svg
                    ref={svgRef}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox={dynamicViewBox}
                    width="100%"
                    height="auto"
                    aria-labelledby={`svg-title-${view}`}
                    style={{ display: 'block', transition: 'viewBox 0.4s ease-in-out', borderRadius: '0.75rem', overflow: 'hidden' }}
                >
                    <title id={`svg-title-${view}`}>Human Body {view} View</title>
                    <defs>
                        <clipPath id={`rounded-clip-${view}`}>
                            <rect x={vbX} y={vbY} width={vbWidth} height={vbHeight} rx={12} ry={12} />
                        </clipPath>
                    </defs>
                    <g clipPath={`url(#rounded-clip-${view})`}>
                        {(view === 'front' || view === 'dual') && (
                            <g>{renderBodyParts(frontBodyPartData)}</g>
                        )}
                        {(view === 'back' || view === 'dual') && (
                            <g transform={view === 'dual' ? "translate(596, 0)" : undefined}>
                                {renderBodyParts(backBodyPartData)}
                            </g>
                        )}
                    </g>
                </svg>
            </div>
            {showCredit && (
                <p style={{ fontSize: '10px', textAlign: 'center', color: '#666', marginTop: '8px' }}>
                    Anatomy illustrations by <a href="https://www.ryan-graves.com/" target="_blank" rel="noopener noreferrer">Ryan Graves</a>, used under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> license.
                </p>
            )}
        </div>
    );
};

export default BodyAnatomy;
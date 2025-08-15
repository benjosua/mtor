import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/types";
import type { CSSProperties } from "react";

const strokeSize = 2

export function DropIndicator({ edge, gap }: { edge: Edge; gap: string }) {
    const lineOffset = `calc(-0.5 * (${gap} + ${strokeSize}px))`

    const getInlineStyles = (): CSSProperties => {
        const baseStyles: CSSProperties = {
            position: 'absolute',
            zIndex: 10,
            pointerEvents: 'none',
            backgroundColor: 'transparent',
            opacity: 0.4,
        }

        const horizontalSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='2' viewBox='0 0 12 2'%3E%3Cline x1='0' y1='1' x2='8' y2='1' stroke='white' stroke-width='2'/%3E%3C/svg%3E")`
        const verticalSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='12' viewBox='0 0 2 12'%3E%3Cline x1='1' y1='0' x2='1' y2='8' stroke='white' stroke-width='2'/%3E%3C/svg%3E")`

        switch (edge) {
            case 'top':
                return {
                    ...baseStyles,
                    top: lineOffset,
                    left: '0px',
                    right: '0px',
                    height: `${strokeSize}px`,
                    backgroundImage: horizontalSvg,
                    backgroundRepeat: 'repeat-x',
                }
            case 'bottom':
                return {
                    ...baseStyles,
                    bottom: lineOffset,
                    left: '0px',
                    right: '0px',
                    height: `${strokeSize}px`,
                    backgroundImage: horizontalSvg,
                    backgroundRepeat: 'repeat-x',
                }
            case 'left':
                return {
                    ...baseStyles,
                    left: lineOffset,
                    top: '0px',
                    bottom: '0px',
                    width: `${strokeSize}px`,
                    backgroundImage: verticalSvg,
                    backgroundRepeat: 'repeat-y',
                }
            case 'right':
                return {
                    ...baseStyles,
                    right: lineOffset,
                    top: '0px',
                    bottom: '0px',
                    width: `${strokeSize}px`,
                    backgroundImage: verticalSvg,
                    backgroundRepeat: 'repeat-y',
                }
        }
    }

    return <div style={getInlineStyles()} />
}
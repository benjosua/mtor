<p align="center">
  <img src="public/logo.png" alt="mTOR Logo" width="120">
</p>

# mTOR Workout Tracker

## Philosophy

This application serves as a local-first, offline-capable training environment designed to bridge the gap between raw data logging and actionable sports science. It utilizes Conflict-Free Replicated Data Types (CRDTs) via Jazz to treat the client device as the authoritative source of truth, enabling zero-latency interaction and mesh-network synchronization without reliance on centralized APIs. The system automates the cognitive load of training by algorithmically managing progressive overload, volume regulation, and recovery analysis.

## Scientific Progression Algorithms

The application replaces static linear progression with a dynamic decision engine derived from current hypertrophy and strength training literature.

**Performance Analysis & Autoregulation**
Post-session logic evaluates set performance against target Reps in Reserve (RIR) and defined rep ranges. The algorithm branches based on exertion metrics:

- **Mastery State:** Exceeding the top end of the rep range while maintaining target RIR mandates a load increase for the next session. Load increments are context-aware, applying distinct weight jumps for compound barbell movements versus isolation dumbbell exercises.
- **Accumulation State:** Performance meeting the minimum rep threshold but remaining within range prescribes rep additions to drive volume accumulation before intensity increases.

**Estimated Metrics (1RM / 10RM)**
The system calculates estimated One-Rep Max (1RM) and Ten-Rep Max (10RM) in real-time using the Epley formula. This allows for normalized strength comparison across different rep ranges and volume blocks, providing a consistent metric for tracking strength adaptations even during hypertrophy phases.

## Biomechanical Plan Analysis

The plan editor acts as a program auditor, providing real-time feedback on training variables to prevent suboptimal programming.

**Volume & Frequency Audit**
The analyzer parses the entire training week to calculate total sets per muscle group. It cross-references volume against frequency to assess stimulus efficiency:

- **Recovery Risk:** Identifies scenarios where high-volume sessions for a specific muscle group are scheduled without adequate subsequent rest days.
- **Junk Volume Detection:** Flags excessive per-session volume that exceeds the threshold for effective stimulus.
- **Stimulus Distribution:** Visualizes the ratio of primary mover work (direct) versus secondary stabilizer work (indirect) to ensure balanced structural development.

**Anatomical Visualization**
A dynamic SVG engine renders anatomical heatmaps. It maps library metadata to graphical muscle representations, allowing users to visually verify if a plan neglects specific heads (e.g., lateral deltoid vs. anterior deltoid) or posterior chain elements.

## Session Execution & Context Intelligence

The active session interface maintains state persistence across reloads and connectivity loss, utilizing context-aware logic to optimize the workflow.

**Context-Switching Warm-up Logic**
The system monitors the real-time "temperature" of muscle groups during a session. By analyzing the sequence of completed exercises, it determines if a target muscle is already potentiated. If a user transitions to a heavy compound movement for a cold muscle group, the system injects specific warm-up set recommendations. If the muscle was recruited in a previous movement, warm-ups are suppressed.

**Global Rest Timer**
A persistent, non-blocking overlay manages rest intervals independent of the navigation stack. This allows users to leave the active session view to check history, settings, or analytics without disrupting the rest cadence.

**Plate Calculator**
A mathematical utility resolves target weights into specific loading instructions. It respects the user's specific inventory of available plates and bar weight, calculating the optimal asymmetrical or symmetrical loading pattern to match the target load.

**Smart Substitution & Remapping**

- **Context-Aware Swaps:** When replacing an exercise, the search engine filters for alternatives that match the biomechanical profile (primary mover, plane of motion, equipment constraints) of the original.
- **Exercise Remapping:** A reconciliation tool manages data continuity. If an exercise definition is deprecated or merged, users can remap "orphaned" historical records to a new library template, preserving long-term volume and PR tracking.

## Exercise Library & Search

The data layer combines an immutable master library with mutable, user-defined extensions.

**Fuzzy Search & Filtering**
The search engine utilizes fuzzy matching to handle nomenclature variations. It is tightly coupled with a global equipment filter; users define their accessible inventory, and the library automatically hides physically impossible exercises from search results and swap suggestions.

**Custom Exercise Definitions**
Users can author custom movements that inherit the same analytical properties as system exercises. Custom definitions include metadata for primary/secondary muscle recruitment and equipment requirements, ensuring they integrate fully with the progression algorithms and plan analyzer.

## Settings & Data Architecture

**Unit Agnosticism**
The system supports hot-swapping between Metric (kg) and Imperial (lbs) units. This is handled via real-time conversion layers rather than static database values, ensuring historical data remains accurate regardless of the current display preference.

**Granular Overrides**
Progression logic can be tuned at the individual exercise level. Users can define specific rep ranges and RIR targets for distinct movement patterns (e.g., enforcing lower rep ranges for deadlifts while keeping higher ranges for lateral raises), overriding global defaults.

**Privacy & Sync**
Data is encrypted and synchronized via a peer-to-peer mesh network. Authentication is handled via WebAuthn (Passkeys), supporting anonymous-first usage with automatic conflict-free migration to persistent identities.

## Credits

- **Drag and Drop:** Built using [Pragmatic Drag and Drop](https://atlassian.design/components/pragmatic-drag-and-drop/about) by Atlassian.
- **Anatomy Illustrations:** Created by [Ryan Graves](https://www.ryan-graves.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Database/CRDT/Sync/Auth layer:** [Jazz](https://jazz.tools/).

## License

This project is licensed under the [GNU Affero General Public License v3 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.en.html).

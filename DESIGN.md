# Anas Bakkoury — animated GitHub profile

Custom repo-native SVGs, Markdown and GitHub-compatible picture elements.
No JavaScript inside the SVGs, external fonts, analytics, stats-card services,
image generation, or build service is required by the GitHub profile.

## Motion system

- Header: wireframe sphere, three independent particle orbits, slow rotating mesh
  and a softly pulsing core. Your name and introduction remain stationary.
- FactoryGuard: rotating bearing rollers, waveform reveal and sweeping scan.
- Defendly: CV-to-conversation particles and progressively drawn answer lines.
- Graph recovery: progressive connections, node pulses and matrix highlights.
- Privacy evaluation: incoming prompt packets and pulsing output-field blocks.

All illustrations are conceptual, not live measurements, application screenshots,
research-result plots, or evidence of security. Project evidence and limitations
are described in the README and linked source repositories.

## Accessibility and maintenance

The SVGs honor prefers-reduced-motion: reduce. Essential text remains static.
Each SVG has a title, README images have alt text, and explanatory project copy
is available as selectable Markdown. Desktop and mobile artwork switch at 600px.

Regenerate with `python tools/build_assets.py` (standard-library Python only).
For deterministic motion-review frames, use
`python tools/build_assets.py --time 2.5 --out /tmp/profile-review`.
These frames approximate the CSS animation's timing; CSS uses easing for reveals.
The reduced-motion CSS disables all motion, restores full opacity and reveals
complete paths. No scheduled workflows or ongoing maintenance jobs are installed.

Palette: midnight #070b18, electric blue #438cff, hot pink #ff69c8,
ice blue #91b5ff, yellow #ffe46b, foreground #eef5ff and secondary
text #aabbd5. Electric blue is primary; pink and yellow supply contrast.
The header orbits use blue, pink and yellow. Project accents are electric
blue (FactoryGuard), pink (Defendly), ice blue (graph recovery), and yellow
(privacy evaluation).

Project descriptions and result boundaries were checked against repository READMEs
on 2026-11-07. Numerical claims have not been re-evaluated by this design change.
This profile is published through the bakk0u/bakk0u repository.

## Party Parrot footer

Twelve original Party Parrot GIFs, also used by the reference profile, are
bundled locally with upstream attribution. Reduced-motion picture sources
use first-frame PNGs. The preview pause button also pauses these GIFs.
The folder is separate from the generated SVGs and survives regeneration.

GitHub achievements are platform-managed and are not imitated in the README.
On 2026-11-07 the authenticated profile settings showed achievements enabled,
and the public profile visibly showed Pull Shark and Quickdraw.

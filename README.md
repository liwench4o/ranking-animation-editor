# Racing Bar Chart with Visual Foreshadowing

A browser-based **bar chart race** editor with visual foreshadowing and an animated ranking preview. Load a time-series CSV, tune the animation and styling, preview it live, and export the result.

This is the demo for the IEEE VIS 2020 short paper [*Improving Engagement of Animated Visualization with Visual Foreshadowing*](https://doi.org/10.1109/VIS47514.2020.00035) by Wenchao Li, Yun Wang, Haidong Zhang, and Huamin Qu. It's also available on [arXiv](https://arxiv.org/pdf/2009.03784).

![Visual Foreshadowing editor showing a bar chart race of top global brands, with highlighting, animation, and export controls](screenshot.png)

## Getting started

```bash
npm install      # install dependencies
npm start        # start the dev server (webpack-dev-server)
npm test         # run the test suite (vitest)
npm run build    # production build into dist/
```

Then open the URL printed in the terminal.

## Data presets

Sample datasets live in [`data/`](data/) and are bundled at build time via `csv-loader`, then registered as presets in [`src/index.tsx`](src/index.tsx):

- `category-brands.csv`
- `brand_values.csv`
- `spotify-us-weekly-16.csv`

To add your own preset, drop a CSV in `data/`, import it in `src/index.tsx`, and register it with `makePreset(...)`. You can also upload a CSV directly from the app UI at runtime.

## Project layout

```
src/
  chart/         chart color, layout, and theme logic
  components/    React UI (control panel, timeline, canvas, export)
  data/          dataset parsing and time-series helpers
  export/        GIF/MP4 frame rendering and encoding
  foreshadowing/ foreshadowing options, effect envelopes, and resolution
  index.tsx      entry point + built-in presets
data/            sample CSV datasets
```

## Citation

If you use this work, please cite:

```bibtex
@article{Li:2020:Foreshadowing,
  author       = {Wenchao Li and
                  Yun Wang and
                  Haidong Zhang and
                  Huamin Qu},
  title        = {Improving Engagement of Animated Visualization with Visual Foreshadowing},
  booktitle    = {31st {IEEE} Visualization Conference, {IEEE} {VIS} 2020 - Short Papers,
                  Virtual Event, USA, October 25-30, 2020},
  pages        = {141--145},
  publisher    = {{IEEE}},
  year         = {2020},
  url          = {https://doi.org/10.1109/VIS47514.2020.00035},
  doi          = {10.1109/VIS47514.2020.00035}
}
```

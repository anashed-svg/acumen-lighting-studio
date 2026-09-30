import {makeProject} from '@revideo/core';
import {brand} from './brand';
import logoReveal from './scenes/logoReveal';

export default makeProject({
  scenes: [logoReveal],
  variables: brand,
  settings: {
    shared: {size: {x: 1280, y: 720}, background: brand.background},
    rendering: {fps: 30, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}},
    preview: {fps: 30},
  },
});

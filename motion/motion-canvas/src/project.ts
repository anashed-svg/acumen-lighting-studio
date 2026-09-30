import {makeProject} from '@motion-canvas/core';
import {brand} from './brand';
import facade from './scenes/facade?scene';

declare const __BRAND__: Partial<typeof brand>;

// Resolution / fps / exporter live in project.meta (the editor's Rendering tab edits it).
export default makeProject({
  scenes: [facade],
  variables: {...brand, ...__BRAND__},
});

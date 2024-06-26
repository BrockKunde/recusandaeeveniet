# @uprtcl/lenses

[![](https://img.shields.io/npm/v/@uprtcl/lenses)](https://www.npmjs.com/package/@uprtcl/lenses)

This package provides a basic lenses rendering engine for the `@uprtcl/cortex` framework. Cortex needs a rendering engine of this type in order for it to work in the frontend.

This module declares and exposes this native HTMLElement:

- `<cortex-entity>`: entry point of the engine. This element takes a `hash` property, and is responsible for fetching, recognizing, and rendering the object in the appropiate lens.

## Documentation

Visit our [documentation site](https://uprtcl.github.io/js-uprtcl).

## Install

```bash
npm install @uprtcl/lenses
```

## Usage

Import the module, instantiate it with its appropiate configuration, and load it:

```ts
import { MicroOrchestrator } from '@uprtcl/micro-orchestrator';
import { LensesBindings } from '@uprtcl/cortex';
import { LensesModule } from '@uprtcl/lenses';

const orchestrator = new MicroOrchestrator();

const lenses = new LensesModule({});
await orchestrator.loadModule(lenses);
```

In your `html`, now you can use `<cortex-entity>`:

```html
<cortex-entity id="cortex-entity-rendering" />
```

Now we need to pass the `hash` attribute down to the element. Each JS frontend framework has its own way of doing it (props for React, inputs for Angular...). This is how you can do it in vanilla JS:

```js
const cortexEntityElement = document.getElementById('cortex-entity-rendering');
cortexEntityElement.hash = '[HASH-OF-THE-ENTITY-WE-WANT-TO-LOAD]';
```

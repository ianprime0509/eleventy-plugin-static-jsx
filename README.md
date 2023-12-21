# eleventy-plugin-static-jsx

This is a plugin for [Eleventy](https://www.11ty.dev/) to add support for JSX
and [MDX](https://mdxjs.com/) as template formats, using
[static-jsx](https://github.com/ianprime0509/static-jsx).

## Installation

Install using NPM (or any similar tool, such as Yarn):

```shell
npm install eleventy-plugin-static-jsx
```

This requires static-jsx and Eleventy as peer dependencies. Since this requires
Eleventy's
[support for custom file extension handlers](https://github.com/11ty/eleventy/issues/117),
part of the 1.0 release, the beta 1.0 version of Eleventy must be used for now
(until 1.0 is actually released):

```shell
npm install static-jsx @11ty/eleventy@beta
```

Then, add the plugin in your Eleventy configuration (`.eleventy.js`):

```js
const jsx = require("eleventy-plugin-static-jsx");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(jsx);
};
```

## Usage

### MDX

`.mdx` template files are supported. Any YAML frontmatter is treated as template
data, and any Eleventy data (including an additional `children` member
containing any `content` as `RawHtml`) is passed as the `props` object.

Here's an example of a simple MDX template:

```mdx
---
layout: layouts/post.jsx
title: Simple post
---

import Chart from "../_includes/Chart.jsx";

This is a simple post with the title "{props.title}". Here is a chart showing
something:

<Chart />
```

### JSX

Any `.jsx` template file must export at least a `render` function as the default
export, which returns `RawHtml` (the return type of any JSX expression under
static-jsx). A `data` object is passed to `render` containing all the Eleventy
data corresponding to the template, and
[JavaScript template functions](https://www.11ty.dev/docs/languages/javascript/#javascript-template-functions)
are accessible on `this` within the render function (similar to the built-in
`.11ty.js` template format). In addition to the usual data, a `children` member
is passed in the `data` option containing any `content` passed to the template
wrapped in `RawHtml` so it behaves as `children` normally would in a JSX
component.

**Note:** when writing a JSX template, use the `children` prop for child content
(as in standard React convention) rather than Eleventy's `content` to avoid
double escaping the output.

Here's an example of a simple JSX template using just a `render` function which
serves as a top-level layout:

```jsx
import { RawHtml } from "static-jsx";

export default function render({ children, title, today }) {
  return (
    <>
      {/* JSX doesn't support doctypes natively, so we have to use RawHtml */}
      {new RawHtml("<!DOCTYPE html>")}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body>
          <main>{children}</main>
          {/* formatCopyrightDate is a JavaScript template function */}
          <footer>
            Copyright {this.formatCopyrightDate(today)} Ian Johnson
          </footer>
        </body>
      </html>
    </>
  );
}
```

A JSX template may also export `data`, which may be a simple object or a
(possibly `async`) function returning an object, to provide
[front matter data](https://www.11ty.dev/docs/data-frontmatter/) for the
template. The following example uses this to create a specialized template for a
blog post which in turn uses another template as a layout:

```jsx
export const data = {
  layout: "layouts/main.jsx",
};

export default function render({ children, title }) {
  return (
    <>
      <header>
        <h1>{title}</h1>
      </header>

      <article>{children}</article>
    </>
  );
}
```

### Caveats

Due to Node.js's current lack of (non-experimental) custom module loaders (which
would be necessary for importing JSX and MDX files), exports and imports are
internally transformed into something that allows a custom import function to be
substituted. This internal transformation is missing several cases of `import`
and `export` syntax (see the tests in `recma-module-shims.test.mjs`): in
particular, dynamic imports (`await import`) are not transformed, so it is not
possible to dynamically import other JSX and MDX files.

This is not technically impossible to fix, but I will most likely wait until
custom module loaders are more stable/usable and release a new major version
which uses that (cleaner) approach.

## License

This is free software, released under the
[Zero Clause BSD License](https://spdx.org/licenses/0BSD.html), as found in the
`LICENSE` file of this repository. This license places no restrictions on your
use, modification, or redistribution of the library: providing attribution is
appreciated, but not required.

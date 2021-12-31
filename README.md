# eleventy-plugin-static-jsx

This is a plugin for [Eleventy](https://www.11ty.dev/) to add support for JSX as
a template format, using
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

Any `.jsx` template file must export at least a `render` function, which returns
`RawHtml` (the return type of any JSX expression under static-jsx). A `data`
object is passed to `render` containing all the Eleventy data corresponding to
the template, and
[JavaScript template functions](https://www.11ty.dev/docs/languages/javascript/#javascript-template-functions)
are accessible on `this` within the render function (similar to the built-in
`.11ty.js` template format). In addition to the usual data, a `children` member
is passed in the `data` option containing any `content` passed to the template
wrapped in `RawHtml` so it behaves as `children` normally would in a JSX
component.

Here's an example of a simple JSX template using just a `render` function which
serves as a top-level layout:

```jsx
import { RawHtml } from "static-jsx";

export function render({ children, title, today }) {
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

export function render({ children, title }) {
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

## License

This is free software, released under the
[MIT license](https://opensource.org/licenses/MIT).
